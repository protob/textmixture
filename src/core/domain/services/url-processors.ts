import * as R from 'remeda'
import TurndownService from 'turndown'
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { remark } from 'remark'
import strip from 'strip-markdown'
import { logger } from '@utils/logger'

const extractMainContent = (html: string, url: string): string | null => {
    try {
        const dom = new JSDOM(html, { url })
        const reader = new Readability(dom.window.document)
        const article = reader.parse()
        return article ? article.content : null
    } catch (error) {
        logger.error('Readability failed to parse HTML:', { error, url })
        return null
    }
}

const createTurndownService = () => {
    return new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '_',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full',
        blankReplacement: () => ''
    }).use(gfm)
}

const cleanWikiContent = (content: string): string =>
    R.pipe(
        content,
        content => content
            .replace(/\[edit]/g, '')
            .replace(/\[update]/g, '')
            .replace(/\[page needed]/g, '')
            .replace(/^\^.*$/gm, '')
            .replace(/^\s*\n/gm, '')
            .replace(/\n{3,}/g, '\n\n')
    )

const cleanSimpleContent = (content: string): string =>
    R.pipe(
        content,
        content => content
            .replace(/^\^.*$/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    )

export const processWikiContent = async (html: string, url: string): Promise<string> => {
    const mainContent = extractMainContent(html, url)
    if (!mainContent) {
        throw new Error('Failed to extract main content')
    }

    const turndownService = createTurndownService()
    const markdown = turndownService.turndown(mainContent)

    const processedMarkdown = await remark()
        .use(strip)
        .process(markdown)

    return cleanWikiContent(String(processedMarkdown))
}

export const processSimpleContent = async (html: string, url: string): Promise<string> => {
    const mainContent = extractMainContent(html, url)
    if (!mainContent) {
        throw new Error('Failed to extract main content')
    }

    const turndownService = createTurndownService()
    const markdown = turndownService.turndown(mainContent)

    return cleanSimpleContent(markdown)
}