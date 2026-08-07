// feathersClient.js
// Sets up the connection between the React app and the FeathersJS backend.

import feathers from '@feathersjs/feathers';
import rest from '@feathersjs/rest-client';
import auth from '@feathersjs/authentication-client';

// Point this at wherever your backend is running
const BACKEND_URL = 'http://localhost:3030';

const restClient = rest(BACKEND_URL);

const client = feathers();

// Use fetch under the hood to talk to the REST API
client.configure(restClient.fetch(window.fetch.bind(window)));

// Handles storing/attaching the JWT automatically on every request
client.configure(auth({ storage: window.localStorage }));

export default client;
