const { readdir, stat, readFile, writeFile, mkdir, rename, unlink, rm } = require('fs/promises');
const { join, dirname } = require('path');
const { fileURLToPath } = require('url');

const srcDir = process.cwd();
const destDir = join(srcDir, '_staticBuild');

let ensembleName;

async function copyFiles(src, dest, doReplace = true) {
    try {
        const files = await readdir(src);
        for (const file of files) {
            const srcPath = join(src, file);
            const destPath = join(dest, file);

            if (
                srcPath.includes('node_modules') ||
                srcPath.endsWith('src/main.jsx') ||
                srcPath.includes('staticBuild')
            ) {
                continue;
            }

            const stats = await stat(srcPath);

            if (stats.isDirectory()) {
                await mkdir(destPath, { recursive: true });
                await copyFiles(srcPath, destPath);
            } else if (
                stats.isFile() && 
                (
                    srcPath.endsWith('.js') ||
                    srcPath.endsWith('.json') ||
                    srcPath.endsWith('build.md')
                )
            ) {
                const data = (await readFile(srcPath, 'utf8'))
                    .replaceAll(`@${ensembleName}`, `ensembles/${ensembleName}`)
                    .replaceAll(`>{ensembleLocation}`, `dashboard/ensembles/${ensembleName}`);

                await mkdir(dirname(destPath), { recursive: true });
                await writeFile(destPath, data, 'utf8');
            }
        }
    } catch (err) {
        console.error(err);
    }
}

const moveFiles = async (srcDir, destDir) => {
    const outerDir = join(srcDir, 'staticBuild');
    const dashboardDir = join(outerDir, 'app\/dashboard\/ensembles');

    await mkdir(
        dashboardDir, 
        { recursive: true }
    );

    const libDir = join(dashboardDir, ensembleName);

    await rename(
        destDir,
        libDir
    );

    await rm(join(libDir, 'public'), { recursive: true });
    await Promise.all([
        'build.js',
        'config.json',
        'package.json',
        'package-lock.json',
        'vite.config.js'
    ].map(p => unlink(join(libDir, p))));

    await rename(
        join(libDir, 'src\/library.js'),
        join(libDir, `src\/index.js`)
    );

    await mkdir(
        join(outerDir, 'src\/ensembles'), 
        { recursive: true }
    );

    await rename(
        join(libDir, 'src'),
        join(outerDir, `src\/ensembles\/${ensembleName}`)
    );

    const themeNames = await readdir(join(libDir, 'theme'));
    for (let themeName of themeNames) {
        if (!themeName.includes(ensembleName)) {
            await unlink(join(libDir, `theme\/${themeName}`));

            continue;
        }

        await rename(
            join(libDir, `theme\/${themeName}`),
            join(libDir, `theme\/_${themeName}`)
        );
    }

    await rename(
        join(libDir, 'theme'),
        join(srcDir, 'staticBuild\/app\/theme')
    );

    await rename(
        join(libDir, 'README.build.md'),
        join(outerDir, `README.ensemble.${ensembleName}.md`)
    );
};

async function main() {
    try {
        const data = await readFile(
            join(srcDir, 'package.json'),
            'utf8'
        );
        const packageFile = JSON.parse(data);
        ensembleName = packageFile.opusPackagerConfig.ensembleName

        await mkdir(destDir, { recursive: true });
        await copyFiles(srcDir, destDir);
        await moveFiles(srcDir, destDir);
    } catch (err) {
        console.error(err);
    }
}

main();
