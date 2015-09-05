const express = require('express');
const app = express();
const bodyParser = require('body-parser')

app.use(bodyParser.json());
app.set('port', (process.env.PORT || 5000));

app.post('/', (request, response) => {
    console.info('Got request', request);
    response.end();
});

app.listen(app.get('port'), () => {
    console.log('Node app is running on port', app.get('port'));
});
