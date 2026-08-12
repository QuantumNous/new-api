import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { run } from '../../lib/run';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const documentCorpus = readFileSync(
  join(__dirname, '../../../data/compaction-data.txt'),
  'utf-8',
);

const largeDocumentCorpus = `
=== REFERENCE DOCUMENT COPY 1 ===
${documentCorpus}

=== REFERENCE DOCUMENT COPY 2 ===
${documentCorpus}

=== REFERENCE DOCUMENT COPY 3 ===
${documentCorpus}

=== REFERENCE DOCUMENT COPY 4 ===
${documentCorpus}

=== REFERENCE DOCUMENT COPY 5 ===
${documentCorpus}
`;

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.2'),
    messages: [
      {
        role: 'user',
        content: `I need help understanding modern web development. Here's a comprehensive reference guide I've been studying (with multiple copies for redundancy):\n\n${largeDocumentCorpus}\n\nBased on this documentation, can you explain the key differences between React and Vue.js state management approaches?`,
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Based on the comprehensive documentation you've shared, I can explain the key differences between React and Vue.js state management:
            **React State Management:**

            React offers multiple approaches documented in your guide:

            1. **Built-in Hooks** (useState, useReducer):
              - useState for simple local state
              - useReducer for more complex state logic with actions

            2. **Context API** (useContext):
              - For sharing state across components without prop drilling
              - Combined with useReducer for Redux-like patterns

            3. **Redux**:
              - Centralized store with actions and reducers
              - Uses useSelector and useDispatch hooks
              - Follows strict unidirectional data flow

            **Vue.js State Management:**

            Vue provides a more opinionated approach:

            1. **Composition API** (ref, reactive, computed):
              - ref() for primitive values
              - reactive() for objects
              - computed() for derived state

            2. **Pinia** (Official State Management):
              - Simpler API than Vuex
              - Stores defined with defineStore()
              - Built-in support for state, getters, and actions

            Would you like me to dive deeper into any specific aspect?`,
          },
        ],
      },
      {
        role: 'user',
        content:
          'Yes, can you explain the Docker and Kubernetes sections in more detail? How do they work together for container orchestration?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Great question! Let me break down Docker and Kubernetes from your documentation:
            **Docker (Containerization)**

            Docker is the foundation for containerization:

            1. **Dockerfile** - Defines how to build your application image:
              - Base image selection (e.g., node:22-alpine)
              - Working directory setup
              - Dependency installation
              - Source code copying

            2. **Docker Compose** - Orchestrates multiple containers locally:
              - Defines services (app, db, redis)
              - Manages networking between containers
              - Handles volume persistence

            **Kubernetes (Container Orchestration)**

            Kubernetes manages containers at scale:

            1. **Deployments** - Define desired state:
              - Number of replicas
              - Container specifications
              - Resource limits (CPU, memory)

            2. **Services** - Expose applications:
              - LoadBalancer for external access
              - ClusterIP for internal communication

            3. **Ingress** - Route external traffic:
              - Host-based routing
              - Path-based routing

            **Workflow:**
            1. Development: Use Docker Compose locally
            2. Build: Create Docker images with CI/CD
            3. Push: Upload images to container registry
            4. Deploy: Kubernetes pulls images and manages pods
            5. Scale: Kubernetes handles replicas and load balancing

            Would you like me to explain more about testing or security?`,
          },
        ],
      },
      {
        role: 'user',
        content:
          'Now explain the testing strategies section. What are the differences between unit tests, integration tests, and E2E tests?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Based on the Testing Strategies section in your documentation:
            **Unit Testing (with Jest)**

            Unit tests focus on individual functions or components in isolation:
            - Test single units of code (functions, classes, components)
            - Mock external dependencies
            - Fast execution, run frequently during development
            - Use describe blocks for grouping related tests
            - Use expect assertions with matchers like toBe, toEqual

            **Integration Testing**

            Integration tests verify that multiple components work together correctly:
            - Test API endpoints with tools like supertest
            - Verify request/response flow
            - Test database interactions
            - Check authentication and authorization flows
            - Validate that services communicate properly

            **E2E Testing (with Playwright)**

            End-to-end tests simulate real user behavior:
            - Test complete user flows through the application
            - Navigate pages with page.goto()
            - Interact with elements (fill forms, click buttons)
            - Assert on page state (URLs, content, visibility)
            - Run in real browser environments

            **Testing Pyramid:**
            - Many unit tests (fast, cheap)
            - Fewer integration tests (moderate speed)
            - Few E2E tests (slow, expensive)

            Would you like me to explain databases or algorithms next?`,
          },
        ],
      },
      {
        role: 'user',
        content:
          'Yes, explain the SQL and NoSQL database sections. What are the key differences and when should I use each?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Based on the Database Systems section of your documentation:
            **Relational Databases (SQL)**

            SQL databases like PostgreSQL use structured schemas:

            1. **Data Definition Language (DDL)**:
              - CREATE TABLE with columns, types, constraints
              - ALTER TABLE for schema modifications
              - DROP TABLE for removal

            2. **Data Manipulation (DML)**:
              - INSERT for adding records
              - UPDATE for modifications
              - DELETE for removal
              - SELECT with JOINs for querying

            3. **Advanced Features**:
              - Window functions (ROW_NUMBER, RANK)
              - CTEs for complex queries
              - Indexing strategies (B-Tree, GIN, GiST)

            **NoSQL Databases**

            1. **Document Databases (MongoDB)**:
              - Flexible schemas with embedded documents
              - Aggregation pipelines
              - Good for variable structure data

            2. **Key-Value Stores (Redis)**:
              - Strings, Lists, Sets, Sorted Sets, Hashes
              - Pub/Sub for real-time messaging
              - Great for caching

            3. **Graph Databases (Neo4j)**:
              - Nodes and relationships
              - Cypher query language
              - Best for connected data

            **When to Use:**
            - SQL: Structured data, complex queries, ACID transactions
            - NoSQL: Flexible schemas, high scalability, specific access patterns

            Want me to cover algorithms and data structures?`,
          },
        ],
      },
      {
        role: 'user',
        content:
          'Finally, summarize the key algorithms and data structures that every developer should know according to the documentation.',
      },
    ],
    providerOptions: {
      openai: {
        store: false,
        contextManagement: [{ type: 'compaction', compactThreshold: 50000 }],
      },
    },
  });

  console.log('=== Response ===');
  console.log(result.text);

  console.log('\n=== Raw Response Body ===');
  console.dir(result.response.body, { depth: Infinity });

  console.log('\n=== Provider Metadata ===');
  console.log(JSON.stringify(result.finalStep.providerMetadata, null, 2));
});
