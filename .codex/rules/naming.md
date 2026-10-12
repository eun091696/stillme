# Naming Rule

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

Defines predictable names for code, documents, branches, APIs, database objects, events, and operational identifiers.

## Goals

- Make search and ownership obvious.
- Prevent multiple names for the same domain concept.

## Requirements

- Use domain language from `.codex/memory/glossary.md`.
- Follow existing framework and directory conventions.
- Avoid abbreviations unless they are canonical business terms.

## Implementation

Use PascalCase for React components and types, camelCase for TypeScript values, uppercase underscore filenames in `docs/`, lowercase filenames in `.codex/`, snake_case for database identifiers, and descriptive slash-free branch names prefixed by change type.

## Checklist

- [ ] Names use canonical domain vocabulary.
- [ ] Singular/plural usage is consistent.
- [ ] File and identifier casing matches its layer.
- [ ] Renames update all references.

## Related Documents

- [Glossary](../memory/glossary.md)
- [Documentation Rule](documentation.md)
- [Database Rule](database.md)
