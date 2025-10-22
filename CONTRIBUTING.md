# Contributing to PondPilot CORS Proxy

Thank you for your interest in contributing to the PondPilot CORS Proxy!

## 🤝 How to Contribute

### Reporting Issues

If you find a bug or have a feature request:

1. **Search existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear, descriptive title
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - Your environment (OS, Node version, deployment type)

### Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead, email [security@pondpilot.io](mailto:security@pondpilot.io) with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

We'll respond within 48 hours.

## 🔧 Development Setup

### Prerequisites

- Node.js 18 or later
- Docker (optional, for testing)
- Git

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/cors-proxy.git
cd cors-proxy

# Cloudflare Worker
cd cloudflare-worker
npm install
npm run dev

# Self-Hosted
cd ../self-hosted
npm install
npm run dev
```

## 📝 Code Guidelines

### TypeScript Style

- Use TypeScript strict mode
- Prefer interfaces over types
- Use const assertions where appropriate
- Add JSDoc comments for public APIs

### Code Quality

- **Linting**: Code must pass ESLint (TODO: add config)
- **Formatting**: Use Prettier (TODO: add config)
- **Type Safety**: No `any` types without justification
- **Comments**: Explain "why", not "what"

### Security

- **No Logging**: Never log request URLs or content
- **No Storage**: Never store proxied data
- **Validation**: Always validate inputs
- **Rate Limiting**: Maintain rate limit protections

## 🧪 Testing

### Manual Testing

```bash
# Start the proxy
npm run dev

# Test health endpoint
curl http://localhost:3000/health

# Test proxy
curl "http://localhost:3000/proxy?url=https%3A%2F%2Fexample.com" \
  -H "Origin: http://localhost:5173"
```

### Automated Tests

TODO: Add test framework

```bash
npm test
```

## 📋 Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**:
   - Follow code guidelines
   - Add tests if applicable
   - Update documentation
4. **Commit** with clear messages:
   ```bash
   git commit -m "Add: feature description"
   ```
5. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a Pull Request**:
   - Describe what changed and why
   - Link related issues
   - Request review

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated (when applicable)
- [ ] No security issues introduced
- [ ] Privacy guarantees maintained

## 🎯 Areas for Contribution

### High Priority

- [ ] Automated tests (unit + integration)
- [ ] Performance benchmarks
- [ ] Monitoring/observability improvements
- [ ] Documentation improvements

### Feature Ideas

- [ ] Support for more HTTP methods (POST for file uploads?)
- [ ] Advanced caching strategies
- [ ] Metrics/analytics (privacy-preserving)
- [ ] Admin dashboard
- [ ] CDN integration

### Not Accepting

- Features that compromise privacy (logging, tracking, etc.)
- Features that reduce security
- Overly complex features

## 📖 Documentation

When adding features:

- Update README.md
- Add usage examples
- Update INTEGRATION.md if affects PondPilot
- Update SECURITY.md if affects security model

## 🏷️ Commit Message Format

Use conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(worker): add domain blocklist support
fix(self-hosted): correct rate limit window calculation
docs(readme): add deployment guide for Railway
```

## 🔄 Review Process

1. **Automated Checks**: Must pass CI/CD (TODO)
2. **Code Review**: At least one maintainer approval required
3. **Testing**: Manual testing by reviewer
4. **Merge**: Squash and merge to main

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 💬 Questions?

- Open a [GitHub Discussion](https://github.com/yourusername/cors-proxy/discussions)
- Email: [hello@pondpilot.io](mailto:hello@pondpilot.io)

## 🙏 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation (if desired)

Thank you for contributing to open source! 🎉
