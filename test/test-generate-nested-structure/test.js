const { readFile } = require('fs').promises;
const { join } = require('path');

const expectedOutput = {
    "dashboard": {
        "components": {
            "appTitle.json": {
                "acceptPrps": {},
                "type": "label",
                "prps": {
                    "caption": "{theme.global.welcomeText}",
                    "color": "themeRed"
                }
            }
        },
        "index.json": {
            "startup": "rootDashboard",
            "themes": [
                "colors",
                "global"
            ],
            "themeSets": []
        },
        "rootDashboard.json": {
            "acceptPrps": {},
            "traits": [
                {
                    "trait": "components/appTitle",
                    "traitPrps": {}
                }
            ]
        }
    },
    "theme": {
        "colors.json": {
            "themeRed": "#dd1122"
        },
        "global.json": {
            "themeConfig": {
                "isStyleTheme": false
            },
            "welcomeText": "Opus UI Packager Test"
        }
    }
};

describe('test-generate-nested-structure: Generated app.json matches expected structure', () => {
    test('Files and folders are recursively generated correctly from the app directory.', async () => {
        const generatedAppPath = join(__dirname, 'public', 'app.json');
        const generatedContent = await readFile(generatedAppPath, 'utf8');
        const generatedJson = JSON.parse(generatedContent);

        expect(generatedJson).toEqual(expectedOutput);
    });
});
