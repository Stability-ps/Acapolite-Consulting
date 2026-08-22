// Provider-agnostic publishing interface. Every provider (meta-facebook,
// meta-instagram, and eventually linkedin) implements the same shape so the
// worker never branches on platform-specific logic outside of picking which
// module to call.

export type PublishRequest = {
  imageUrl: string; // short-lived signed URL the provider can fetch the poster from
  caption: string;
  providerAccountId: string; // Facebook Page ID / IG Business Account ID / (future) LinkedIn org URN
};

export type PublishSuccess = {
  ok: true;
  providerPostId: string;
  permalink: string | null;
};

// Thrown, not returned, so a provider can never accidentally "succeed" by
// forgetting to check a response - every non-success path is an exception
// the worker must classify via the two error classes below.
export class TemporaryPublishError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TemporaryPublishError";
    this.code = code;
  }
}

export class PermanentPublishError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PermanentPublishError";
    this.code = code;
  }
}

export type SocialProvider = {
  key: string;
  publish: (request: PublishRequest) => Promise<PublishSuccess>;
};
