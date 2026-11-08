# Chrome lifecycle

Owns one idle timeout, document visibility subscription and independent panel/focus/content locks. Book identity resets state; cleanup cancels the timeout. No periodic updates run when hidden or pinned. Unsupported formats pass enabled=false and retain visible controls. Content bridges must dispose before their session is replaced.
