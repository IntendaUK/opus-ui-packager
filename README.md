# Introduction 
This tool builds a single json object (tree) which contains all json files inside a root folder. The tree will accurately represent the folder structure within.

# Usage

## 1. Install the packager
`npm i --save-dev opus-ui-packager`

## 2. Add the config to your `package.json` file
```
"opusPackagerConfig": {
	"appDir": "app",
	"packagedDir": "public",
	"packagedFileName": "app"
}
```

`appDir`: The folder in which your application JSON is stored, relative to your `package.json` file
`packagedDir`: In which folder the packaged JSON file will be stored
`packagedFileName`: The name of the packaged JSON file

## 3. Build your JSON package
`node node_modules/opus-ui-packager/src/packager.js`

## 4. Setting up automatic builds during development
While, optional, it is recommended that you do the following so that your package can automatically be rebuilt when needed:

### 1. Install nodemon
`npm i --save-dev nodemon`

### 2. Set up your nodemon config in the `package.json` file
```
"nodemonConfig": {
	"ignore": [],
	"watch": [
		"%yourAppDir%"
	],
	"ext": "js,json,md",
	"ignoreRoot": [],
	"delay": 100
}
```

### 3. Run nodemon to automatically rebuild your JSON package when needed
`nodemon node_modules/opus-ui-packager/src/packager.js`
