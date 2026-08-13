# Removing an address from the directory

If your organisation's address is listed here and you would rather it were not,
we will remove it. You do not need to give a reason, prove ownership beyond a
basic check, or talk to anyone.

## How

Either:

1. **Open an issue** titled `Removal: <domain>` on the repository, or
2. **Open a pull request** deleting the record from `directory.json` and adding
   the address to `suppression.json`.

Removals are merged on sight and are not debated.

## What happens to it

The address goes into `suppression.json`, which is permanent. The outreach tool
subtracts the suppression list from every batch it builds, and the CI validator
rejects any future pull request that tries to re-add a suppressed address. So a
removal stays a removal even if someone later contributes the same address in
good faith from a public page.

## Suppression list format

`suppression.json` stores a SHA-256 hash of the lowercased address rather than
the address itself, so that removing an address does not leave it published in
a second file. Add an entry with:

```
pnpm --filter @siyar/contacts suppress <address>
```
