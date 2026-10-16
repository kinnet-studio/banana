import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';

const SCRIPT = resolve(__dirname, '../scripts/vercel-ignore-build.sh');

const SKIP = 0;
const BUILD = 1;

let repo: string;

function git(...args: string[]): string {
    const result = Bun.spawnSync(['git', ...args], {
        cwd: repo,
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'test',
            GIT_AUTHOR_EMAIL: 'test@example.com',
            GIT_COMMITTER_NAME: 'test',
            GIT_COMMITTER_EMAIL: 'test@example.com',
        },
    });
    if (result.exitCode !== 0) {
        throw new Error(`git ${args.join(' ')}: ${result.stderr.toString()}`);
    }
    return result.stdout.toString().trim();
}

/** Writes the given files and commits them, returning the commit SHA. */
function commit(files: Record<string, string>): string {
    for (const [path, content] of Object.entries(files)) {
        const full = join(repo, path);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
    }
    git('add', '-A');
    git('commit', '-q', '-m', 'change');
    return git('rev-parse', 'HEAD');
}

/** Runs the ignore step in `cwd` (the repo root by default). */
function ignoreStep(previousSha: string | undefined, cwd = repo): number {
    const env: Record<string, string> = { ...process.env } as Record<
        string,
        string
    >;
    delete env.VERCEL_GIT_PREVIOUS_SHA;
    if (previousSha !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = previousSha;
    return Bun.spawnSync(['bash', SCRIPT], { cwd, env }).exitCode;
}

beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
    git('init', '-q');
});

afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
});

describe('vercel-ignore-build.sh', () => {
    it('skips when only the worker changed', () => {
        const deployed = commit({
            'src/app.ts': 'v1',
            'workers/pmtiles/a': '1',
        });
        commit({ 'workers/pmtiles/a': '2' });
        expect(ignoreStep(deployed)).toBe(SKIP);
    });

    it('builds when the app changed', () => {
        const deployed = commit({ 'src/app.ts': 'v1' });
        commit({ 'src/app.ts': 'v2' });
        expect(ignoreStep(deployed)).toBe(BUILD);
    });

    it('builds when the app and the worker changed together', () => {
        const deployed = commit({ 'src/app.ts': 'v1' });
        commit({ 'src/app.ts': 'v2', 'workers/pmtiles/a': '1' });
        expect(ignoreStep(deployed)).toBe(BUILD);
    });

    it('builds when an earlier commit in the push changed the app', () => {
        const deployed = commit({ 'src/app.ts': 'v1' });
        commit({ 'src/app.ts': 'v2' });
        commit({ 'workers/pmtiles/a': '1' });
        expect(ignoreStep(deployed)).toBe(BUILD);
    });

    it('builds for root files outside the worker, like package.json', () => {
        const deployed = commit({ 'package.json': '{}' });
        commit({ 'package.json': '{"name":"banana"}' });
        expect(ignoreStep(deployed)).toBe(BUILD);
    });

    it('does not treat look-alike paths as the worker', () => {
        const deployed = commit({ 'workers/pmtiles-old/a': '1' });
        commit({ 'workers/pmtiles-old/a': '2' });
        expect(ignoreStep(deployed)).toBe(BUILD);
    });

    it('builds on the first deployment of a branch', () => {
        commit({ 'workers/pmtiles/a': '1' });
        expect(ignoreStep(undefined)).toBe(BUILD);
        expect(ignoreStep('')).toBe(BUILD);
    });

    it('builds when the previous deployment is not in the clone', () => {
        commit({ 'workers/pmtiles/a': '1' });
        expect(ignoreStep('0123456789abcdef0123456789abcdef01234567')).toBe(
            BUILD
        );
    });

    it('compares the whole repo when run from a subdirectory', () => {
        const deployed = commit({
            'src/app.ts': 'v1',
            'workers/pmtiles/a': '1',
        });
        commit({ 'src/app.ts': 'v2' });
        expect(ignoreStep(deployed, join(repo, 'workers/pmtiles'))).toBe(BUILD);
    });
});
