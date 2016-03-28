// Dependencies
const atob = require('atob');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const GitHubApi = require('github');
const _ = require('lodash');
const ESLintCLIEngine = require('eslint').CLIEngine;

// Config variables

import {GITHUB_USERNAME, GITHUB_PASSWORD, REPOSITORY_OWNER, REPOSITORY_NAME, FILE_FILTER} from './config';

// Github configuration

const github = new GitHubApi({
    version: '3.0.0',
    headers: {
        'user-agent': 'ESLint-bot' // GitHub is happy with a unique user agent
    }
});
github.authenticate({
    type: 'basic',
    username: GITHUB_USERNAME,
    password: GITHUB_PASSWORD
});

// Eslint configuration

const eslint = new ESLintCLIEngine();

// Functions

/**
 * Get commits from a payload object.
 * @param  {Object} payload         the payload sent by Github
 * @return {Array} the commits pushed to Github
 */
const getCommitsFromPayload = payload => payload.commits;

/**
 * Get modified files from a commit.
 * @param  {Function} callback      callback called when the files are fetched
 * @param  {Object}   {id}          the commit object
 */
const getFilesFromCommit = (callback, {id: sha}) => {
    github.repos.getCommit({
        user: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
        sha
    }, (error, {files}) => {
        if (error) {
            console.log(error);
        }
        callback(files, sha);
    });
};

/**
 * Filter files to keep only Javascript files. ESLint is for Javascript. No kidding.
 * @param  {Array} files        every files contained in the commit
 * @return {Array} Filtered files, which matched the FILE_FILTER regex (set in the config)
 */
const filterJavascriptFiles = files => files.filter(({filename}) => filename.match(FILE_FILTER));

/**
 * Download a file from its url, then call the callback with its content.
 * @param  {Function} callback          Download success callback
 * @param  {String}   filename          File filename
 * @param  {String}   patch             The commit's patch string.
 * @param  {String}   raw_url           File URL
 * @param  {String}   sha               Commit id
 */
const downloadFile = (callback, {filename, patch, raw_url}, sha) => { // eslint-disable-line
        
    github.repos.getContent({
        user: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME,
        path: filename,
        ref: sha

    }, (error, data) => {
        if (error) {
            console.log(error);
        }else{
            callback(filename, patch, atob(data.content), sha);
        }
    });

};

/**
 * Compute a mapping object for the relationship 'file line number' <-> 'Github's diff view line number'.
 * This is necessary for the comments, as Github API asks to specify the line number in the diff view to attach an inline comment to.
 * If a file line is not modified, then it will not appear in the diff view, so it is not taken into account here.
 * The linter will therefore only mention warnings for modified lines.
 * @param  {String}   patchString               The git patch string.
 * @return {Object} An object shaped as follows : {'file line number': 'diff view line number'}.
 */
const getLineMapFromPatchString = patchString => {
    let diffLineIndex = 0;
    let fileLineIndex = 0;
    return patchString.split('\n').reduce((lineMap, line) => {
        if (line.match(/^@@.*/)) {
            fileLineIndex = line.match(/\+[0-9]+/)[0].slice(1) - 1;
        } else {
            diffLineIndex++;
            if ('-' !== line[0]) {
                fileLineIndex++;
                if ('+' === line[0]) {
                    lineMap[fileLineIndex] = diffLineIndex;
                }
            }
        }
        return lineMap;
    }, {});
};

/**
 * Lint a raw content passed as a string, then return the linting messages.
 * @param  {String} filename File filename
 * @param  {String} patch    Commit's Git patch
 * @param  {String} content  File content
 * @param  {String} sha      Commit's id
 * @return {Array}  Linting messages
 */
const lintContent = (filename, patch, content, sha) => {
    return {filename, lineMap: getLineMapFromPatchString(patch), messages: _.get(eslint.executeOnText(content, filename), 'results[0].messages'), sha};
};

/**
 * Send a comment to Github's commit view
 * @param  {String} filename File filename
 * @param  {Object} lineMap  The map between file and diff view line numbers
 * @param  {String} ruleId ESLint rule id
 * @param  {String} message  ESLint message
 * @param  {Integer} line  Line number (in the file)
 * @param  {String} sha      Commit's id
 */
const sendSingleComment = (filename, lineMap, {ruleId='Eslint', message, line}, sha) => {
    const diffLinePosition = lineMap[line];
    if (diffLinePosition) { // By testing this, we skip the linting messages related to non-modified lines.
        const data ={
            user: REPOSITORY_OWNER,
            repo: REPOSITORY_NAME,
            sha,
            path: filename,
            commit_id: sha, // eslint-disable-line
            body: `**${ruleId}**: ${message}`,
            position: diffLinePosition
        };
        github.repos.createCommitComment(data);
    }
};

/**
 * Send the comments for all the linting messages, to Github
 * @param  {String} filename File filename
 * @param  {Object} lineMap  The map between file and diff view line numbers
 * @param  {Array} messages  ESLint messages
 * @param  {String} sha      Commit's id
 */
const sendComments = ({filename, lineMap, messages, sha}) => {
    messages.map(message => sendSingleComment(filename, lineMap, message, sha));
};

/**
 * Main function, that treats the payload sent by Github.
 * First it gets the commits, the it extracts the filenames from the commit, downloads and filters the files.
 * The remaining files are analyzed by the linter, and the resulting linting messages are sent to Github as inline comments.
 * @param  {Object} payload Push event's payload sent by Github.
 */
const treatPayload = payload => {
    getCommitsFromPayload(payload).map(commit => {
        getFilesFromCommit((files, sha) => {
            filterJavascriptFiles(files).map(file => {
                downloadFile(_.compose(sendComments, lintContent), file, sha);
            });
        }, commit);
    });
};

// Server

app.use(bodyParser.json());

app.set('port', (process.env.PORT || 5000));

app.post('/', ({body: payload}, response) => {
    if (payload && payload.commits) {
        treatPayload(payload);
    }
    response.end();
});

app.listen(app.get('port'), () => {
    console.log('Node app is running on port', app.get('port'));
});
