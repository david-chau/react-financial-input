# WORK IN PROGRESS - revamp underway !!!

# financial-input

[![Node.js Package](https://github.com/david-chau/financial-input/actions/workflows/npm-publish.yml/badge.svg?branch=main)](https://github.com/david-chau/financial-input/actions/workflows/npm-publish.yml)

A React financial input component written in Typescript that works in mobile and desktop browsers.

Key features:
- auto-formatting to money format (i.e `123,456,789.01`)
- prevents invalid input whether typed, dragged or pasted
- default `h`,`k`,`m`,`b`  multiplier keys

## Usage
### Install package
`npm install financial-input`

### Import the component
```
import { FinancialInput, FinancialInputProps } from 'financial-input';
...
const props: FinancialInputProps = {...}
...
return (
<div className='my-app'>
    <FinancialInput {...props}/>
</div>
```

## Options
### scale
Type: `number`  
Default: `2`

Maximum number of decimal digits the value can take

##### range
Type: `string`  
Default: `ALL`

The possible range of values that the value can take

Possible Values:
- `'ALL'`: Number can take any value
- `'POSITIVE'`: Number can only be positive

##### shortcuts
Type: `Object { [character]: multiplier }`  
Default: `{
'h: 100,
'k': 1000,
'm': 1000000,
'b': 1000000000
}`  
An object mapping of shortcuts that the user can use to quickly enter common values.
E.g. with the default shortcuts, typing `k` will multiply the number value by 1000

## Props
##### options
Retrieves the options on the input

#### value
Retrieves the formatted value of the input (string)

The following functions are exposed on the returned finput instance:

## Developing
Install dependencies:
- `npm install`

To see the component, you can run the example test app
- `npm start`

You can also use storybook as well
- `npm run storybook`

To add new dependencies, ensure they are correctly added in either `dependencies`, `peerDependencies` or `devDependencies`.

Building Library
----------------
- `npm run build` will create a build into `dist` folder

Running tests
-------------
Execute the tests locally:
- `npm test`

Releasing
---------
`npm publish` will publish the build files in `dist`, there is a pre-publish step to always build when publishing.
