# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-02-20

### Added

- `@marlinjai/data-table-adapter-data-brain` — HTTP-backed DatabaseAdapter using Data Brain SDK
  - Drop-in replacement for D1/memory adapters when running client-side
  - Delegates all 43 DatabaseAdapter methods to Data Brain API via SDK

### Fixed

- `@marlinjai/data-table-adapter-d1` — Added missing `dt_views` table to initial migration

## [0.1.0] - 2026-01-11

### Added

- Initial release of Notion-like data table component library
- `@marlinjai/data-table-core` - Core types and interfaces
- `@marlinjai/data-table-react` - React components for data table UI
- `@marlinjai/data-table-adapter-d1` - Cloudflare D1 database adapter
- `@marlinjai/data-table-adapter-memory` - In-memory adapter for testing/development
- `@marlinjai/data-table-file-adapter-storage-brain` - File storage adapter
