import * as R from 'remeda';

import { verifyLoaderYamlMetadata } from './verify-loader-yaml-metadata';
import { verifyLoaderContent } from './verify-loader-content';
import { verifyLoaderUrlSimple } from './verify-loader-url-simple';
import { verifyLoaderUrlWiki } from './verify-loader-url-wiki';
import { verifyDialogue } from './verify-dialogue';

import { logger } from '@utils/logger';

type VerifierFunction = () => Promise<{ success: boolean; error?: string } | void>;

interface Verifier {
    name: string;
    func: VerifierFunction;
}

const verifiers: Verifier[] = [
    { name: 'YAML Metadata Loader', func: verifyLoaderYamlMetadata },
    { name: 'Loader FS Content', func: verifyLoaderContent },
    { name: 'Loader URL Simple', func: verifyLoaderUrlSimple },
    { name: 'Loader URL Wiki', func: verifyLoaderUrlWiki },
    { name: 'Dialogue Generation', func: verifyDialogue },
];

interface Result {
    name: string;
    success: boolean;
    error?: string;
}

const runAllVerifiers = async () => {
    const results = await Promise.all(
        R.map(verifiers, async ({ name, func }): Promise<Result> => {
            logger.info(`Running verifier: ${name}`);
            try {
                const res = await func();
                return res && 'success' in res
                    ? { name, success: res.success, error: res.error }
                    : { name, success: true };
            } catch (error) {
                return {
                    name,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        })
    );

    const successCount = R.sumBy(results, r => r.success ? 1 : 0);
    const failureCount = results.length - successCount;

    logger.info('Verification Summary:');
    R.forEach(results, r =>
        r.success
            ? logger.success(`✅ ${r.name}`)
            : logger.error(`❌ ${r.name}: ${r.error}`)
    );

    logger.info(`\nTotal: ${results.length}, Successes: ${successCount}, Failures: ${failureCount}`);
    process.exit(failureCount > 0 ? 1 : 0);
};

if (import.meta.main) runAllVerifiers();


export { runAllVerifiers };
