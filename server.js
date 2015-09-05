const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const GitHubApi = require('github');
const _ = require('lodash');
const request = require('request');
const ESLintCLIEngine = require('eslint').CLIEngine;

// Github configuration

const github = new GitHubApi({
    version: '3.0.0',
    headers: {
        'user-agent': 'Github-linter' // GitHub is happy with a unique user agent
    }
});
github.authenticate({
    type: 'basic',
    username: process.env.GITHUB_USERNAME,
    password: process.env.GITHUB_PASSWORD
});

// Eslint configuration

const eslint = new ESLintCLIEngine();

// Functions

const getCommitsFromPayload = payload => payload.commits;

const getFilesFromCommit = (callback, {id: sha}, {user, repo}) => {
    github.repos.getCommit({
        user,
        repo,
        sha
    }, (error, {files}) => {
        callback(files, sha);
    });
};

const filterJavascriptFiles = files => files.filter(({filename}) => filename.match(/\.(js|jsx)$/) && filename.match(/^src.*/));

const downloadFile = (callback, {filename, patch, raw_url}, sha, config) => {
    request(raw_url, (error, response, content) => {
        callback(filename, patch, content, sha, config);
    });
};

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

const lintContent = (filename, patch, content, sha, config) => {
    return {filename, lineMap: getLineMapFromPatchString(patch), messages: _.get(eslint.executeOnText(content, filename), 'results[0].messages'), sha, config};
};

const sendSingleComment = (filename, lineMap, {ruleId='Eslint', message, line}, sha, {user, repo}) => {
    const diffLinePosition = lineMap[line];
    if (diffLinePosition) {
        github.repos.createCommitComment({
            user,
            repo,
            sha,
            path: filename,
            commit_id: sha,
            body: `**${ruleId}**: ${message}`,
            position: diffLinePosition
        });
    }
};

const sendComments = ({filename, lineMap, messages, sha, config}) => {
    messages.map(message => sendSingleComment(filename, lineMap, message, sha, config));
};

const treatPayload = (config, payload) => {
    getCommitsFromPayload(payload).map(commit => {
        getFilesFromCommit((files, sha) => {
            filterJavascriptFiles(files).map(file => {
                downloadFile(_.compose(sendComments, lintContent), file, sha, config);
            });
        }, commit, config);
    });
};

// Server

app.use(bodyParser.json());

app.set('port', (process.env.PORT || 5000));

app.post('/focus', ({body: payload}, response) => {
    treatPayload({user: 'Kleegroup', repo: 'focus'}, payload);
    response.end();
});

app.post('/focus-components', ({body: payload}, response) => {
    treatPayload({user: 'Kleegroup', repo: 'focus-components'}, payload);
    response.end();
});

app.listen(app.get('port'), () => {
    console.log('Node app is running on port', app.get('port'));
});
