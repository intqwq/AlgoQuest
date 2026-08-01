import {
  oiAlgorithmTags,
  publicOjProblem,
} from "../oj.mjs";

export async function handlePublicOjRoutes(context) {
  const { request, response, url, database, json, ApiError, boundedText } =
    context;
  if (request.method === "GET" && url.pathname === "/v1/oj/tags") {
    json(response, 200, { tags: oiAlgorithmTags });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/oj/problems") {
    const query = boundedText(url.searchParams.get("query"), 160);
    const requestedDifficulty = Number(url.searchParams.get("difficulty"));
    const difficulty =
      Number.isInteger(requestedDifficulty) &&
      requestedDifficulty >= 1 &&
      requestedDifficulty <= 10
        ? requestedDifficulty
        : undefined;
    const tag = boundedText(url.searchParams.get("tag"), 80);
    const page = Math.max(
      1,
      Math.round(Number(url.searchParams.get("page")) || 1),
    );
    const limit = Math.min(
      60,
      Math.max(1, Math.round(Number(url.searchParams.get("limit")) || 30)),
    );
    const result = await database.listPublishedOjProblems({
      query,
      difficulty,
      tag,
      limit,
      offset: (page - 1) * limit,
    });
    json(response, 200, {
      problems: result.problems.map((problem) =>
        publicOjProblem(problem, { includeStatement: false }),
      ),
      total: result.total,
      page,
      limit,
    });
    return true;
  }
  const match = url.pathname.match(/^\/v1\/oj\/problems\/(\d{1,12})$/);
  if (request.method === "GET" && match) {
    const problem = await database.getPublishedOjProblem(Number(match[1]));
    if (!problem) throw new ApiError(404, "OJ_PROBLEM_NOT_FOUND");
    json(response, 200, { problem: publicOjProblem(problem) });
    return true;
  }
  return false;
}

export async function handlePlayerOjRoutes(context) {
  const {
    request,
    response,
    url,
    database,
    player,
    json,
    ApiError,
    readJson,
    requirePlayableAccount,
    validUuid,
    validatedOjProblem,
  } = context;
  if (request.method === "POST" && url.pathname === "/v1/oj/problems") {
    requirePlayableAccount(player);
    const allowed = await database.consumeRateLimit(
      "oj_problem_submit:user",
      player.id,
      10,
      60 * 60,
    );
    if (!allowed) {
      throw new ApiError(429, "OJ_SUBMISSION_RATE_LIMITED", {
        retryAfterMs: 60 * 60 * 1000,
      });
    }
    const body = await readJson(request, 8 * 1024 * 1024);
    json(response, 201, {
      problem: await database.createOjProblem(
        player.id,
        validatedOjProblem(body),
      ),
    });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/v1/oj/mine") {
    requirePlayableAccount(player);
    json(response, 200, {
      problems: await database.listAuthorOjProblems(player.id),
    });
    return true;
  }
  const match = url.pathname.match(
    /^\/v1\/oj\/drafts\/([0-9a-f-]{36})$/i,
  );
  if (request.method === "PUT" && match) {
    requirePlayableAccount(player);
    if (!validUuid(match[1])) {
      throw new ApiError(400, "INVALID_OJ_DRAFT_ID");
    }
    const allowed = await database.consumeRateLimit(
      "oj_problem_resubmit:user",
      player.id,
      20,
      60 * 60,
    );
    if (!allowed) {
      throw new ApiError(429, "OJ_SUBMISSION_RATE_LIMITED", {
        retryAfterMs: 60 * 60 * 1000,
      });
    }
    const body = await readJson(request, 8 * 1024 * 1024);
    const problem = await database.updateOjProblemDraft(
      match[1],
      player.id,
      validatedOjProblem(body),
    );
    if (!problem) throw new ApiError(404, "OJ_DRAFT_NOT_FOUND");
    json(response, 200, { problem });
    return true;
  }
  return false;
}

export async function handleAdminOjRoutes(context) {
  const {
    request,
    response,
    url,
    database,
    player,
    json,
    ApiError,
    readJson,
    requireAdmin,
    validUuid,
    boundedText,
  } = context;
  if (request.method === "GET" && url.pathname === "/v1/admin/oj/problems") {
    requireAdmin(player);
    const requestedStatus = url.searchParams.get("status");
    const status = ["pending", "published", "rejected"].includes(
      requestedStatus,
    )
      ? requestedStatus
      : "pending";
    json(response, 200, {
      problems: await database.listOjProblemsForModeration(status),
    });
    return true;
  }
  const match = url.pathname.match(
    /^\/v1\/admin\/oj\/problems\/([0-9a-f-]{36})$/i,
  );
  if (request.method === "PATCH" && match) {
    requireAdmin(player);
    if (!validUuid(match[1])) {
      throw new ApiError(400, "INVALID_OJ_DRAFT_ID");
    }
    const body = await readJson(request, 8 * 1024);
    if (body.status !== "published" && body.status !== "rejected") {
      throw new ApiError(400, "INVALID_OJ_REVIEW_STATUS");
    }
    const reviewNote = boundedText(body.reviewNote, 1000);
    if (body.status === "rejected" && reviewNote.length < 3) {
      throw new ApiError(400, "OJ_REJECTION_REASON_REQUIRED");
    }
    const problem = await database.moderateOjProblem(
      match[1],
      body.status,
      player.id,
      reviewNote,
    );
    if (!problem) {
      throw new ApiError(404, "OJ_PROBLEM_NOT_REVIEWABLE");
    }
    json(response, 200, { problem });
    return true;
  }
  return false;
}
