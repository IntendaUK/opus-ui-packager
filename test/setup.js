const path = require('path');
const { execSync } = require('child_process');

beforeAll(() => {
    // Get the current test file's directory
    const testDir = path.dirname(expect.getState().testPath);

    // Calculate relative path to packager
    const relativeToRoot = path.relative(process.cwd(), testDir);
    const levelsDeep = relativeToRoot.split(path.sep).length;
    const upToRoot = Array(levelsDeep).fill('..').join('/');
    const packagerPath = path.join(upToRoot, 'src/packager.js');

    try {
        execSync(`node "${packagerPath}"`, {
            cwd: testDir,
            stdio: 'inherit' // This will show packager output in test logs
        });
    } catch (error) {
        console.error(`Failed to run packager in ${testDir}:`, error.message);
        throw error; // Re-throw to fail the test
    }
});