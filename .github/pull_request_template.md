### Title Format
[Service Name] - Brief description of changes

### Change Type
- [ ] Feature
- [ ] Bug Fix
- [ ] Performance Improvement
- [ ] Security Update
- [ ] Documentation
- [ ] Infrastructure Change

### Description
#### Changes Made
<!-- Provide a detailed description of the changes -->

#### Related Issues
<!-- Link to related issues/tickets -->

#### Breaking Changes
<!-- List any breaking changes and migration steps -->

#### Dependencies Added/Updated
<!-- List new or updated dependencies with versions -->

#### Performance Impact
<!-- Describe performance implications and benchmarks -->

#### Security Considerations
<!-- Detail security implications and mitigations -->

### Validation Checklist

#### Testing
- [ ] Unit tests added/updated with >80% coverage
- [ ] Integration tests added for new endpoints/features
- [ ] E2E tests passing in staging environment
- [ ] Performance benchmarks run and documented
- [ ] Load testing completed for critical paths
- [ ] Browser compatibility verified (Frontend)
  - [ ] Chrome 90+
  - [ ] Firefox 88+
  - [ ] Safari 14+
  - [ ] Edge 90+
- [ ] Mobile responsiveness validated (Frontend)
  - [ ] 320px (Mobile)
  - [ ] 768px (Tablet)
  - [ ] 1024px (Desktop)
  - [ ] 1440px (Wide)

#### Security
- [ ] Security scan completed with no high/critical issues
- [ ] OWASP top 10 vulnerabilities checked
- [ ] API security review completed
- [ ] Data privacy impact assessed
- [ ] Authentication/Authorization tested
- [ ] CSP headers validated (Frontend)

#### Documentation
- [ ] Code documentation updated
- [ ] API changes documented in OpenAPI spec
- [ ] Breaking changes documented with migration guide
- [ ] README/Wiki updated if applicable
- [ ] Architecture diagrams updated if applicable

#### Deployment
- [ ] Environment variables documented and updated
- [ ] Database migration scripts tested
- [ ] Rollback procedure documented
- [ ] Monitoring/Alerting configured
  - [ ] Error tracking
  - [ ] Performance metrics
  - [ ] Custom business metrics
- [ ] Resource requirements validated
  - [ ] CPU/Memory limits
  - [ ] Storage requirements
  - [ ] Network bandwidth
- [ ] Cost impact assessed

### Reviewer Checklist
- [ ] Code review completed by peer
- [ ] Architecture review for significant changes
- [ ] Security review for sensitive changes
- [ ] Performance impact verified
- [ ] Test coverage validated
- [ ] Documentation accuracy confirmed

### Additional Notes
<!-- Any additional information that would help with the review -->