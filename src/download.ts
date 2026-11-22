import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { aborted } from 'node:util'
import { isBlockedAddress } from '@chatluna/search'
import type { Http } from '@cordisjs/plugin-http'

// Vision limits JSON requests to 10 MB, including the base64 envelope.
const MAX_IMAGE_BYTES = 7_000_000

async function publicAddress(host: string, signal: AbortSignal) {
    signal.throwIfAborted()
    const resolution = lookup(host, { all: true, order: 'ipv4first' })
    const addresses = await Promise.race([
        resolution,
        aborted(signal, resolution).then((): never => { throw signal.reason })
    ])
    if (!addresses.length || addresses.some(entry => isBlockedAddress(entry.address))) {
        throw new Error('请使用公网图片 URL。')
    }
    return addresses[0]!.address
}

export async function downloadImage(http: Http, source: string, options: { signal: AbortSignal; timeout: number; proxyAgent?: string }): Promise<string> {
    const signal = AbortSignal.any([options.signal, AbortSignal.timeout(options.timeout)])
    const proxy = http.resolveConfig(options).proxyAgent
    let url = new URL(source)
    for (let hop = 0; hop <= 5; hop++) {
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('请使用公网图片 URL。')
        const host = url.hostname.replace(/^\[|\]$/g, '')
        const address = await publicAddress(host, signal)
        // Both a direct socket and a proxy tunnel connect to the checked IP.
        // Keep the original hostname for virtual hosting and certificate checks.
        const target = new URL(url)
        target.hostname = isIP(address) === 6 ? '[' + address + ']' : address
        const tls = isIP(host) ? {} : { servername: host }
        const dispatcher = proxy ? new http.undici.ProxyAgent({ uri: proxy, requestTls: tls })
            : new http.undici.Agent({ connect: tls })
        try {
            const response = await dispatcher.request({
                origin: target.origin, path: target.pathname + target.search, method: 'GET',
                headers: { host: url.host, accept: 'image/*' }, signal
            })
            const location = response.headers['location']
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && typeof location === 'string') {
                url = new URL(location, url)
                continue
            }
            if (response.statusCode < 200 || response.statusCode >= 300) throw new Error('获取图片失败，HTTP ' + response.statusCode)
            const chunks: Buffer[] = []
            let size = 0
            for await (const chunk of response.body) {
                size += chunk.length
                if (size > MAX_IMAGE_BYTES) throw new Error('图像超过 Google Vision 请求大小限制。')
                chunks.push(chunk)
            }
            if (!size) throw new Error('图片内容为空。')
            return Buffer.concat(chunks).toString('base64')
        } finally { await dispatcher.destroy() }
    }
    throw new Error('图片链接重定向次数过多。')
}
