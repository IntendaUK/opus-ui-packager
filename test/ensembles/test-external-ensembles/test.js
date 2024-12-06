const { readFile } = require('fs').promises;
const { join } = require('path');

const expectedOutput = {
    "dashboard": {
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
                    "trait": "@ensembleWithoutConfig/input/index",
                    "traitPrps": {
                        "placeholder": "Enter a value..."
                    }
                }
            ]
        },
        "@ensembleWithoutConfig": {
            "input": {
                "index.json": {
                    "acceptPrps": {
                        "label": "string"
                    },
                    "type": "input",
                    "prps": {
                        "placeholder": "placeholder"
                    }
                }
            }
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
            "initialValue": "Jon Doe"
        }
    }
};

describe('test-external-ensembles: Generated app.json matches expected structure', () => {
    test('External ensembles are correctly generated.', async () => {
        const generatedAppPath = join(__dirname, 'public', 'app.json');
        const generatedContent = await readFile(generatedAppPath, 'utf8');
        const generatedJson = JSON.parse(generatedContent);

        expect(generatedJson).toEqual(expectedOutput);
    });
});
