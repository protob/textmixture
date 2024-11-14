import chalk from 'chalk'

export const logger = {
    info: (msg: string, meta?: unknown) =>
        console.log(chalk.blue('ℹ'), msg, meta && Object.keys(meta).length > 0 ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),

    error: (msg: string, meta?: unknown) =>
        console.error(chalk.red('✖'), msg, meta && Object.keys(meta).length > 0 ? chalk.red(JSON.stringify(meta, null, 2)) : ''),

    success: (msg: string, meta?: unknown) =>
        console.log(chalk.green('✔'), msg, meta && Object.keys(meta).length > 0 ? chalk.gray(JSON.stringify(meta, null, 2)) : ''),

    debug: (msg: string, meta?: unknown) =>
        console.debug(chalk.magenta('🐛'), msg, meta && Object.keys(meta).length > 0 ? chalk.gray(JSON.stringify(meta, null, 2)) : '')
}
