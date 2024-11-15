import * as R from 'remeda';

import { verifyLoaderYamlMetadata } from './verify-loader-yaml-metadata';
import { verifyLoaderContent } from './verify-loader-content';
import { verifyLoaderUrlSimple } from './verify-loader-url-simple';
import { verifyLoaderUrlWiki } from './verify-loader-url-wiki';
import { verifyDialogue } from './verify-dialogue';
import { verifyEnricher } from './verify-enricher';
import {verifyAudioOpenAI} from './verify-audio-openai';
import { verifyAudioElevenLabs } from './verify-audio-elevenlabs';
import { verifyDialogueAudioSynthesis } from './verify-audio-dialogue-synthesis';
import { verifyDSP } from './verify-audio-dsp';


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
    { name: 'Enricher', func: verifyEnricher },
    { name: 'Audio OpenAI', func: verifyAudioOpenAI },
    { name: 'Audio ElevenLabs', func: verifyAudioElevenLabs },
    { name: 'Audio Dialogue Synthesis', func: verifyDialogueAudioSynthesis },
    { name: 'Audio DSP', func: verifyDSP },
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

if (import.meta.main) {
    runAllVerifiers().catch((error) => {
        logger.error('Unhandled error in runAllVerifiers', {
            error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    });
}



export { runAllVerifiers };
