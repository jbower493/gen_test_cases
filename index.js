#!/usr/bin/env node

// Imports
const fs = require("fs");

// Take in task id and directory
const [,, taskId, directory] = process.argv;

const readDirRecursive = (dir) => {
    const specs = [];

    // Function to recall on every dir
    const pullSpecsFromDir = (dirPath) => {
        // Get all files and folder names in top level dir
        const contents = fs.readdirSync(dirPath);

        // Loop through each file / folder in top level dir
        contents.forEach((name) => {
            const fullPath = `${dirPath}/${name}`;
            const stat = fs.lstatSync(`${dirPath}/${name}`);

            // If its a file, push the full file path onto specs array
            if (!stat.isDirectory()) return specs.push(fullPath);

            // If its a directory, recall self on directory
            pullSpecsFromDir(fullPath);
        });
    };

    pullSpecsFromDir(dir);

    return specs;
};

const specs = readDirRecursive(directory);

console.log(specs);
