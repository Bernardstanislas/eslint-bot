# ESLint bot

ESLint bot is a tool that will help your improve your Javascript code quality by linting it automatically with the excellent [ESLint](http://eslint.org) whenever a change is pushed to your Github repository, and sending back comments directly on Github.

Once plugged on your repo's webhooks, any pushed code will be linted, then commented directly on the commit page on Github.

## Example

You can see it in action on [this sample commit](https://github.com/KleeGroup/focus/commit/4cd9f0b9f7bd9a5662a294b52ff1704e7bdf9c9a).

## Installation

Clone the repo, then do a

```bash
npm install
```

*Optional* : create a new Github account for your bot, which will be used to author the comments.

## Configuration

You need to provide credentials to the Github account you want to use for the post-linting comments, as well as a file filter regex to determine whether a changed file should be linted or not.

This configuration is held by the `config.js` file, as follows :

```javascript
export const GITHUB_USERNAME = 'username'; // Your bot's Github username
export const GITHUB_PASSWORD = 'password'; // Your bot's Github password

export const REPOSITORY_OWNER = 'owner/organisation';   // The owner of the repository you want to run the bot on.
export const REPOSITORY_NAME = 'name';                  // The name of the repository you want to run the bot on.

export const FILE_FILTER = /.*(.js|.jsx)$/; // By default, lint every single .js or .jsx file
```

You also need to configure ESLint through the [.eslintrc](http://eslint.org/docs/user-guide/configuring). That's where all your linting rules go.

Eventually, you'll need to register your bot as a webhook for the repo you want to lint. Simply go the the settings page of your repo and add a new webhook pointing at your server's URL. Leave all the other options at their default value.

**Note** : you might be working on a npm-based project, in that case don't forget to modify the `FILE_FILTER` value to fit your needs and ignore the `node_modules` directory, otherwise you will end up with a slightly overshooting bot linting all your dependencies...

## Running

To start the bot simply run
```bash
npm run start
```

## Moving on

You might have noticed the `Procfile` in the repository. It enables you to run the bot on a [Heroku](https://www.heroku.com) VM.

I find it very convenient for this tool since you don't need many resources to run this small server. Moreover, you will be provided a fixed DNS, which is very convenient to register the webhook from Github.
