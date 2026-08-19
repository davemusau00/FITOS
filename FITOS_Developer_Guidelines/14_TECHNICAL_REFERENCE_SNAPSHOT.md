# FITOS Technical Reference Snapshot
## Prepared 2026-08-19

This file records the reference assumptions used while preparing the developer guidelines. Versions should be reviewed during implementation rather than copied forever.

## React

React’s official documentation recommends using a framework for many new applications, while also documenting building React apps from scratch when the project constraints call for it.

FITOS deliberately uses a React SPA architecture because the core product is an authenticated operational application and the deployment requirement is a conventional VPS. The public tenant website can be extended with prerendering/SSR or separated later if SEO requirements justify it.

Official:
- https://react.dev/learn/creating-a-react-app
- https://react.dev/learn/installation

## Vite

Vite produces optimized production assets using its build command. The default build output is `dist`.

Important: Vite’s preview server is documented for local preview, not as a production server.

Official:
- https://vite.dev/guide/
- https://vite.dev/guide/build.html
- https://vite.dev/guide/static-deploy.html
- https://vite.dev/guide/env-and-mode.html

## Node.js

As of this snapshot:
- Node.js v24 is LTS.
- Node.js v26 is Current.
- Node.js documentation recommends production applications use Active LTS or Maintenance LTS releases.

FITOS therefore targets Node.js 24 LTS for the baseline deployment image in this document.

Official:
- https://nodejs.org/en/about/previous-releases

## NestJS

NestJS provides a structured TypeScript server architecture and documents deployment on a dedicated server/VPS as a valid production model.

Official:
- https://docs.nestjs.com/guide/large-scale-apps
- https://docs.nestjs.com/deployment

## PostgreSQL

At this snapshot PostgreSQL 18 is the current stable documentation line, while PostgreSQL 19 is in beta.

FITOS should remain on a supported stable PostgreSQL release. Do not deploy a beta database for production business data.

Official:
- https://www.postgresql.org/docs/

## Docker Compose

Docker documents Compose as suitable across development, testing, staging and production, including single-server production deployment and production-specific Compose overrides.

Official:
- https://docs.docker.com/compose
- https://docs.docker.com/compose/how-tos/production/

## Nginx

Nginx supports static file serving and reverse proxying and is used in this architecture to serve the React build and proxy `/api` requests to the API container.

Official:
- https://nginx.org/en/docs/beginners_guide.html
- https://nginx.org/en/docs/http/ngx_http_proxy_module.html

## Security

The security baseline uses:
- OWASP ASVS
- OWASP Top 10

At this snapshot, OWASP ASVS 5.0.0 is the latest stable ASVS version and OWASP Top 10:2025 is the current released Top 10.

Official:
- https://owasp.org/www-project-application-security-verification-standard/
- https://owasp.org/Top10/

## Kenya Data Protection

The architecture assumes that fitness assessment, injury, physical/mental health and related records may qualify as sensitive/health-related information depending on what is collected and how it is used.

FITOS therefore uses privacy-by-design principles, access controls, data minimization and an optional health-adjacent module.

Official references:
- https://new.kenyalaw.org/akn/ke/act/2019/24/
- https://www.odpc.go.ke/guidelines-2/

This technical document is not legal advice. Obtain current legal review before deploying regulated health-data functionality.
