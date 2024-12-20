const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const connectDB = require('./config/db');
const typeDefs = require('./schema/typeDefs');
const resolvers = require('./resolvers/resolvers');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { ApolloServerPluginDrainHttpServer } = require('apollo-server-core');
const { makeExecutableSchema } = require('@graphql-tools/schema');

const app = express();

// Enable CORS
app.use(cors());

// Connect to MongoDB
connectDB();

const findAvailablePort = async (startPort) => {
  const net = require('net');
  
  const isPortAvailable = (port) => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  };

  let port = startPort;
  while (port < startPort + 1000) { // Try up to 1000 ports
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error('No available ports found');
};

const startServer = async () => {
  try {
    const initialPort = process.env.PORT || 4000;
    const port = await findAvailablePort(initialPort);
    
    // Create HTTP server
    const httpServer = http.createServer(app);
    
    // Set up WebSocket for subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql',
    });

    // Create schema
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    // Set up subscription server
    const serverCleanup = useServer({ schema }, wsServer);

    const server = new ApolloServer({
      schema,
      context: ({ req }) => {
        // Get admin status from headers
        const isAdmin = req?.headers?.['x-admin'] === 'true';
        return {
          isAdmin
        };
      },
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        {
          async serverWillStart() {
            return {
              async drainServer() {
                await serverCleanup.dispose();
              },
            };
          },
        },
      ],
      formatError: (err) => {
        console.error('GraphQL Error:', err);
        return err;
      },
    });

    await server.start();
    server.applyMiddleware({ app });

    // Start the server
    await new Promise((resolve, reject) => {
      httpServer.listen(port, () => {
        console.log(`🚀 Server ready at http://localhost:${port}${server.graphqlPath}`);
        console.log(`🚀 Subscriptions ready at ws://localhost:${port}${server.graphqlPath}`);
        resolve();
      }).on('error', (err) => {
        reject(err);
      });
    });

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

// First, kill any existing processes on port 4000
const killProcess = async (port) => {
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      execSync(`netstat -ano | findstr :${port}`).toString().split('\n').forEach(line => {
        const pid = line.match(/\s+(\d+)\s*$/)?.[1];
        if (pid) {
          try {
            execSync(`taskkill /F /PID ${pid}`);
          } catch (e) {
            // Ignore errors if process doesn't exist
          }
        }
      });
    }
  } catch (e) {
    // Ignore errors if no process found
  }
};

// Start the server
(async () => {
  await killProcess(4001);
  await startServer();
})();

