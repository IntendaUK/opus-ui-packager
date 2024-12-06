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
                },
                {
                    "trait": "@anotherEnsembleWithoutConfig/input/index",
                    "traitPrps": {
                        "placeholder": "Enter a value..."
                    }
                }
            ]
        },
        "@anotherEnsembleWithoutConfig": {
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

describe('test-internal-ensembles: Generated app.json matches expected structure', () => {
    test('Internal ensembles are correctly generated.', async () => {
        const generatedAppPath = join(__dirname, 'public', 'app.json');
        const generatedContent = await readFile(generatedAppPath, 'utf8');
        const generatedJson = JSON.parse(generatedContent);

        expect(generatedJson).toEqual(expectedOutput);
    });
});
