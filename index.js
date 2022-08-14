#!/usr/bin/env node

/**********************************************************************************************************
 *   IMPORTS
 **********************************************************************************************************/
const fs = require("fs");

/**********************************************************************************************************
 *   CONSTANTS
 **********************************************************************************************************/
const fileExts = [".cy.ts", ".test.ts", ".spec.ts"];
const newLine = "\r\n";
const [, , taskId, directory] = process.argv;

/**********************************************************************************************************
 *   PURE FUNCTIONS
 **********************************************************************************************************/
// Function to extract the text out of a describe or it block
const getBlockNameFromLine = (line) => {
    // Get describe block name
    const firstLine = line;
    const firstQuoteIndex = firstLine.indexOf("(") + 1;
    const firstQuote = firstLine[firstQuoteIndex];
    let nextQuoteIndex;
    firstLine.split("").some((char, index) => {
        if (char !== firstQuote || index === firstQuoteIndex) return false;
        nextQuoteIndex = index;
        return true;
    });
    const blockName = firstLine.slice(firstQuoteIndex + 1, nextQuoteIndex);

    return blockName;
};

// Function to pull all the test cases out of a set of lines, and return them as an array of test cases
const extractTestCases = (linesArr) => {
    return linesArr
        .filter((line) => line.startsWith("it("))
        .map((line) => getBlockNameFromLine(line));
};

// Extract the task id's out of the line of text
const extractTaskIds = (firstLine) => {
    if (!firstLine.trim().startsWith('// [')) return [];

    const describeBlockTaskIdsArr =
        firstLine.split("");
    const charsArray = describeBlockTaskIdsArr.slice(
        describeBlockTaskIdsArr.indexOf("[") + 1,
        describeBlockTaskIdsArr.indexOf("]")
    );
    const idsString = charsArray.join("");
    const describeBlockTaskIds = idsString.split(",");

    return describeBlockTaskIds;
};

// Get all the top level describe blocks within a given set of lines
const getDescribeBlocks = (lines) => {

    // Break it up into each top level describe block
    // Loop through lines and find all the lines that start with a non nested describe call
    const linesWithTopLevelDescribeCall = [];
    lines.forEach((line, i) => {
        // If the line starts with "describe, and its not indented, push its index to the array"
        if (line.startsWith("describe("))
            linesWithTopLevelDescribeCall.push(i);
    });

    // Loop through all the non nested describe calls, and find what line that call ends in, then push a sub array of all its lines onto the "describeBlocks" array
    const describeBlocks = [];
    linesWithTopLevelDescribeCall.forEach(
        (describeCallLineIndex, index) => {
            // Get index of next top level describe, because the line before that is the end of the current describe block
            const describeEndIndex =
                index === linesWithTopLevelDescribeCall.length - 1
                    ? undefined
                    : linesWithTopLevelDescribeCall[index + 1];

            // Get an array of all the lines in this describe block
            const currentDescribeBlockLines = lines.slice(
                describeCallLineIndex,
                describeEndIndex
            );

            // Get rid of first and last line in the describe block, leaving only the actual contents
            const describeBlockContents =
                currentDescribeBlockLines.slice(1, -1);

            // Get describe block task id's
            const describeBlockTaskIds = extractTaskIds(describeBlockContents[0]);

            // Remove top level indentation from describe block content
            const firstCharAfterIndentationIndex =
                describeBlockContents[0].split('').findIndex((value) => /\S/.test(value));
            const contentWithoutTopLevelIndentation =
                describeBlockContents.map((line) =>
                    line.slice(firstCharAfterIndentationIndex)
                );

            // Find all test cases that are not nested in another describe block
            const testCases = extractTestCases(
                contentWithoutTopLevelIndentation
            );

            // Recursively do all this stuff for any nested describe blocks
            const nestedDescribeBlocks = getDescribeBlocks(contentWithoutTopLevelIndentation)

            const describeBlock = {
                taskIds: describeBlockTaskIds,
                name: getBlockNameFromLine(
                    currentDescribeBlockLines[0]
                ),
                tests: testCases,
                describeBlocks: nestedDescribeBlocks
            };

            describeBlocks.push(describeBlock);
        }
    );

    return describeBlocks;
};

/**********************************************************************************************************
 *   MAIN
 **********************************************************************************************************/
const readDirRecursive = (dir) => {
    const testFiles = [];

    // Function to recall on every dir
    const pullTestFilesFromDir = (dirPath) => {
        // Get all files and folder names in top level dir
        const contents = fs.readdirSync(dirPath);

        // Loop through each file / folder in top level dir
        contents.forEach((name) => {
            const fullPath = `${dirPath}/${name}`;
            const stat = fs.lstatSync(`${dirPath}/${name}`);

            // If its a file, push the full file path onto specs array
            if (!stat.isDirectory()) {
                // If its a test file, add it to the list
                if (fileExts.some((ext) => fullPath.endsWith(ext)))
                    return testFiles.push(fullPath);
                // If its not a test file, just return
                return;
            }

            // If its a directory, recall self on directory
            pullTestFilesFromDir(fullPath);
        });
    };

    pullTestFilesFromDir(dir);

    // At this point, 'testFiles' contains all the test files in the given dir
    // Now we need to map that array into an array of objects, with file name, and an array of all its describe blocks

    const formattedTestFiles = testFiles.map((fileName) => {
        // Read the file contents
        const contents = fs.readFileSync(fileName, { encoding: "utf-8" });

        // Get an array of lines in the file
        const allLinesInFile = contents.split(newLine).filter((line) => line);

        // We now have a list of lines for which we need to find all the describe blocks.

        

        // Find all test cases that are not nested in another describe block
        const testCases = extractTestCases(allLinesInFile);

        const describeBlocks = getDescribeBlocks(allLinesInFile);

        // Return an object with "name", and "describeBlocks"
        return {
            name: fileName,
            tests: testCases,
            describeBlocks,
        };
    });

    return formattedTestFiles;
};

const specs = readDirRecursive(directory);

console.log(JSON.stringify(specs, null, 4))




const indentation = '    ';

const getIndentation = (level) => {
    const arr = [];
    for (let i = 0; i < level; i++) {
        arr.push(indentation);
    }

    return arr.join('');
};


const writeToFile = (info) => {
    const writeable = [];
    let recursionDepth = 0;

    // Loop through all test files and format the data into lines
    info.forEach((file) => {
        const { name, describeBlocks } = file;

        // Add the file name with no indentation
        writeable.push(name + newLine);

        const addAllDescribeBlocks = (blocks, calledRecursively) => {
            // Loop through describe blocks and add them
            blocks.forEach((block) => {

                const getDescribeBlockLines = (block) => {
                    // Add the block name and its task ids if any
                    const blockName = `${getIndentation(1 + recursionDepth)}Describe: ${block.name} - ${block.taskIds.join(",")}`;
                    writeable.push(blockName + newLine);
            
                    // List out all its test cases
                    block.tests.map((test) => {
                        // Add the test case
                        const testCase = `${getIndentation(2 + recursionDepth)}${test}`
                        writeable.push(testCase + newLine);
                    })
                };

                getDescribeBlockLines(block);

                // Recursively add all this blocks describe blocks
                if (block.describeBlocks.length > 0) {
                    recursionDepth++;
                    addAllDescribeBlocks(block.describeBlocks, true);
                }

                if (calledRecursively) recursionDepth--;
            });
        };

        addAllDescribeBlocks(describeBlocks);

        // Add a spacer line before next file
        writeable.push(newLine);
    })




    const content = writeable.join('');

    fs.writeFileSync('testDocs/index.txt', content);
};

writeToFile(specs);
