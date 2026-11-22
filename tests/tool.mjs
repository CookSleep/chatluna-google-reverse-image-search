import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileRefTableOf } from '@chatluna/transform'
import { Config, apply } from 'chatluna-plugin-google-reverse-image-search'

function fixture(provider, data, response) {
    const block = { type: 'file', mediaType: 'image/png', data }
    const messages = [{ content: [block] }]
    const call = { agent: { session: { messages: () => messages } }, signal: new AbortController().signal }
    const reference = fileRefTableOf(messages).refOf(block)
    const requests = []
    let tool
    const bytes = Buffer.from('png')
    const storage = {
        async getTempFile(id) {
            assert.equal(id, 'attachment')
            return { data: Promise.resolve(bytes), url: '/files/image.png' }
        },
        async createTempFile(buffer) {
            assert.deepEqual(buffer, bytes)
            return { id: 'attachment', url: '/files/image.png' }
        }
    }
    apply({
        tools: { define(value) { tool = value } }, model: { extend() {} }, chatluna_storage: storage,
        http: Object.assign(async (url, options) => {
            assert.equal(options.signal, call.signal)
            requests.push({ url: new URL(url), options })
            return Response.json(response)
        }, {
            resolveConfig() { return {} },
            undici: { Agent: class {
                request({ origin, path, headers }) {
                    assert.equal(origin + path, 'https://1.1.1.1/input.png')
                    assert.equal(headers.host, '1.1.1.1')
                    return { statusCode: 200, headers: {}, body: [bytes] }
                }
                destroy() {}
            } }
        })
    }, Config({ provider, apiKey: 'fixture', serverPath: 'https://example.org', cacheService: { enable: false } }))
    return { requests, call, reference, tool }
}

test('Google 读取会话附件字节，返回来源页', async () => {
    const { requests, call, reference, tool } = fixture('google', { type: 'reference', reference: 'storage://attachment' },
        { responses: [{ webDetection: { pagesWithMatchingImages: [{ url: 'https://example.org/source' }] } }] })
    const result = await tool.run({ imageUrl: reference }, call)
    assert.deepEqual(requests[0].options.data.requests[0].image, { content: Buffer.from('png').toString('base64') })
    assert.equal(result.webDetection.pagesWithMatchingImages[0].url, 'https://example.org/source')
})

test('Scrapingdog 读取内联附件的公网文件链接，保留匹配结果', async () => {
    const { requests, call, reference, tool } = fixture('scrapingdog', { type: 'data', data: Buffer.from('png').toString('base64') },
        { exact_matches: [{ link: 'https://example.org/source', price: '3', google_goto_link: 'https://api.example/?api_key=fixture' }] })
    const result = await tool.run({ imageUrl: reference }, call)
    assert.equal(new URL(requests[0].url.searchParams.get('url')).searchParams.get('url'), 'https://example.org/files/image.png')
    assert.deepEqual(result.exact_matches, [{ link: 'https://example.org/source' }])
    await assert.rejects(tool.run({ imageUrl: reference }, { ...call, agent: undefined }), /当前对话/)
    await assert.rejects(tool.run({ imageUrl: 'http://127.0.0.1/image' }, call), /公网/)
    await assert.rejects(tool.run({ imageUrl: reference }, { ...call, signal: AbortSignal.abort() }), { name: 'AbortError' })
    assert.equal(requests.length, 1)
})

test('Google 的公网输入由实例读取并作为图片内容提交', async () => {
    const { reference, call, requests, tool } = fixture('google', { type: 'url', url: 'https://1.1.1.1/input.png' },
        { responses: [{ webDetection: {} }] })
    await tool.run({ imageUrl: reference }, call)
    assert.deepEqual(requests[0].options.data.requests[0].image, { content: Buffer.from('png').toString('base64') })
})
