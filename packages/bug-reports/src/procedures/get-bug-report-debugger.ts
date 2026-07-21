import { buildPaginationMeta } from "@crikket/shared/lib/server/pagination"
import { ORPCError } from "@orpc/server"
import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import { eq } from "drizzle-orm"
import { gunzipSync } from "node:zlib"
import { getStorageProvider } from "../lib/storage"

import {
  countBugReportNetworkRequests,
  getBugReportDebuggerEventsData,
  getBugReportNetworkMarkers as getBugReportNetworkMarkersData,
  getBugReportNetworkRequestPayload as getBugReportNetworkRequestPayloadData,
  getBugReportNetworkRequestsPage,
} from "../lib/debugger"
import {
  assertBugReportAccessById,
  bugReportIdInputSchema,
  debuggerNetworkRequestPayloadInputSchema,
  debuggerNetworkRequestsInputSchema,
  normalizeDebuggerNetworkRequestPagination,
} from "../lib/utils"
import { o } from "./context"

export const getBugReportDebuggerEvents = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    return getBugReportDebuggerEventsData(input.id)
  })

export const getBugReportNetworkRequests = o
  .input(debuggerNetworkRequestsInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const { page, perPage, offset, limit } =
      normalizeDebuggerNetworkRequestPagination({
        page: input.page,
        perPage: input.perPage,
      })

    const [totalCount, items] = await Promise.all([
      countBugReportNetworkRequests({
        bugReportId: input.id,
        search: input.search,
      }),
      getBugReportNetworkRequestsPage({
        bugReportId: input.id,
        limit,
        offset,
        search: input.search,
      }),
    ])

    return {
      items,
      pagination: buildPaginationMeta(totalCount, page, perPage),
    }
  })

export const getBugReportNetworkRequestPayload = o
  .input(debuggerNetworkRequestPayloadInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const payload = await getBugReportNetworkRequestPayloadData({
      bugReportId: input.id,
      requestId: input.requestId,
    })

    if (!payload) {
      throw new ORPCError("NOT_FOUND", { message: "Network request not found" })
    }

    return payload
  })

export const getBugReportDomSnapshot = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    const report = await db.query.bugReport.findFirst({
      where: eq(bugReport.id, input.id),
      columns: {
        debuggerKey: true,
        debuggerContentEncoding: true,
      },
    })

    if (!report || !report.debuggerKey) {
      throw new ORPCError("NOT_FOUND", { message: "DOM Snapshot not found" })
    }

    const storage = getStorageProvider()
    
    try {
      const storedPayload = await storage.read(report.debuggerKey)
      const payloadBuffer =
        report.debuggerContentEncoding === "gzip"
          ? gunzipSync(storedPayload)
          : storedPayload
      
      const rawPayload = JSON.parse(payloadBuffer.toString("utf8")) as {
        domSnapshot?: string
      }

      return {
        domSnapshot: rawPayload.domSnapshot ?? null,
      }
    } catch (e) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to read DOM snapshot" })
    }
  })

export const getBugReportNetworkMarkers = o
  .input(bugReportIdInputSchema)
  .handler(async ({ context, input }) => {
    await assertBugReportAccessById({
      id: input.id,
      session: context.session,
    })

    return getBugReportNetworkMarkersData(input.id)
  })
