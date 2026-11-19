---
inclusion: fileMatch
fileMatchPattern: ["src/core/crypto.ts", "src/core/encoding.ts", "src/web/lib/seal.ts", "src/web/pages/Open.tsx", "src/web/pages/Keepsake.tsx", "src/web/pages/Write.tsx"]
---
# Crypto and key custody

Loaded only when a file that seals, splits or opens a letter is in play.

## The scheme
- Each letter gets a fresh random 256-bit key K and a fresh 96-bit IV, made with WebCrypto in the browser.
- The letter is encrypted with AES-GCM and the letter id as additional data, so ciphertext cannot be moved onto another letter.
- K is split: the keepsake half A is 32 random bytes; the vault half B is K xor A. Either half alone is noise.
- The server stores the ciphertext, B and a domain-separated SHA-256 hash of A (the keepsake tag). Never A, never K, never plaintext.

## Rules
- In keepsake custody, A must never be sent to the server, put in a query string, logged, or included in any email. It travels only in a URL fragment (`#k=`) or a printed code the author hands over.
- In vault custody the server holds A too. The UI must say plainly that the operator could read the letter before the author chooses it.
- Check the keepsake tag before spending a one-time open link, so a wrong keepsake never burns the letter.
- After a successful open, the server deletes its sealed copy. A second open shows "already broken", never the letter.
- Remove `#k=` from the address bar (`history.replaceState`) as soon as it has been read.
- Decrypted HTML is sanitised with DOMPurify and an allow-list of tags with no attributes before it is rendered.
- Any change to these files needs a unit test in `tests/unit/crypto.test.ts` or an end-to-end check that the rule above still holds.
