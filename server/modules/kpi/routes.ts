import type { Express } from "express";
import { storage, isAuthenticated, requireUserId } from "../../routes/shared";

export function registerKpiRoutes(app: Express): void {
  app.get("/api/kpi/dashboard/daily", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.query;
      const dashboard = await storage.getKpiDashboardDaily(date as string);
      res.json(dashboard);
    } catch (err: any) {
      console.error("Error fetching daily KPI dashboard:", err);
      res.status(500).json({ message: "Failed to fetch daily KPI dashboard" });
    }
  });

  app.get("/api/kpi/dashboard/weekly", isAuthenticated, async (req, res) => {
    try {
      const { weekStart } = req.query;
      const dashboard = await storage.getKpiDashboardWeekly(weekStart as string);
      res.json(dashboard);
    } catch (err: any) {
      console.error("Error fetching weekly KPI dashboard:", err);
      res.status(500).json({ message: "Failed to fetch weekly KPI dashboard" });
    }
  });

  app.get("/api/kpi/staff/:staffId/summary", isAuthenticated, async (req, res) => {
    try {
      const summary = await storage.getTradesmanKpiSummary(req.params.staffId);
      if (!summary) {
        return res.status(404).json({ message: "Staff not found" });
      }
      res.json(summary);
    } catch (err: any) {
      console.error("Error fetching tradesman KPI summary:", err);
      res.status(500).json({ message: "Failed to fetch tradesman KPI summary" });
    }
  });

  app.get("/api/kpi/snapshots/daily", isAuthenticated, async (req, res) => {
    try {
      const { staffId, dateFrom, dateTo } = req.query;
      const snapshots = await storage.getKpiDailySnapshots(
        staffId as string,
        dateFrom as string,
        dateTo as string
      );
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching daily snapshots:", err);
      res.status(500).json({ message: "Failed to fetch daily snapshots" });
    }
  });

  app.get("/api/kpi/snapshots/weekly", isAuthenticated, async (req, res) => {
    try {
      const { staffId, weekStart } = req.query;
      const snapshots = await storage.getKpiWeeklySnapshots(
        staffId as string,
        weekStart as string
      );
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching weekly snapshots:", err);
      res.status(500).json({ message: "Failed to fetch weekly snapshots" });
    }
  });

  app.get("/api/kpi/snapshots/monthly", isAuthenticated, async (req, res) => {
    try {
      const { month } = req.query;
      const snapshots = await storage.getKpiMonthlySnapshots(month as string);
      res.json(snapshots);
    } catch (err: any) {
      console.error("Error fetching monthly snapshots:", err);
      res.status(500).json({ message: "Failed to fetch monthly snapshots" });
    }
  });

  app.post("/api/kpi/snapshots/daily/:staffId", isAuthenticated, async (req: any, res) => {
    try {
      const { date } = req.body;
      const targetDate = date || new Date().toISOString().split("T")[0];
      const snapshot = await storage.calculateDailyKpiSnapshot(req.params.staffId, targetDate);
      res.status(201).json(snapshot);
    } catch (err: any) {
      console.error("Error calculating daily snapshot:", err);
      res.status(500).json({ message: "Failed to calculate daily snapshot" });
    }
  });

  app.get("/api/kpi/targets", isAuthenticated, async (req, res) => {
    try {
      const targets = await storage.getKpiTargets();
      res.json(targets);
    } catch (err: any) {
      console.error("Error fetching KPI targets:", err);
      res.status(500).json({ message: "Failed to fetch KPI targets" });
    }
  });

  app.get("/api/kpi/targets/:teamConfig", isAuthenticated, async (req, res) => {
    try {
      const target = await storage.getKpiTargetByConfig(req.params.teamConfig);
      if (!target) {
        return res.status(404).json({ message: "Target configuration not found" });
      }
      res.json(target);
    } catch (err: any) {
      console.error("Error fetching KPI target:", err);
      res.status(500).json({ message: "Failed to fetch KPI target" });
    }
  });

  app.get("/api/kpi/alerts", isAuthenticated, async (req, res) => {
    try {
      const { acknowledged } = req.query;
      const ack =
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const alerts = await storage.getKpiAlerts(ack);
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching KPI alerts:", err);
      res.status(500).json({ message: "Failed to fetch KPI alerts" });
    }
  });

  app.get("/api/kpi/alerts/staff/:staffId", isAuthenticated, async (req, res) => {
    try {
      const alerts = await storage.getKpiAlertsByStaff(req.params.staffId);
      res.json(alerts);
    } catch (err: any) {
      console.error("Error fetching staff KPI alerts:", err);
      res.status(500).json({ message: "Failed to fetch staff KPI alerts" });
    }
  });

  app.post("/api/kpi/alerts/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const alert = await storage.acknowledgeKpiAlert(req.params.id, userId);
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      res.json(alert);
    } catch (err: any) {
      console.error("Error acknowledging alert:", err);
      res.status(500).json({ message: "Failed to acknowledge alert" });
    }
  });

  app.get("/api/kpi/bonus", isAuthenticated, async (req, res) => {
    try {
      const { staffId } = req.query;
      const periods = await storage.getBonusPeriods(staffId as string);
      res.json(periods);
    } catch (err: any) {
      console.error("Error fetching bonus periods:", err);
      res.status(500).json({ message: "Failed to fetch bonus periods" });
    }
  });

  app.get("/api/kpi/bonus/current/:staffId", isAuthenticated, async (req, res) => {
    try {
      const period = await storage.getCurrentBonusPeriod(req.params.staffId);
      if (!period) {
        return res.status(404).json({ message: "No current bonus period" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error fetching current bonus period:", err);
      res.status(500).json({ message: "Failed to fetch current bonus period" });
    }
  });

  app.post("/api/kpi/bonus/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const period = await storage.approveBonusPeriod(req.params.id, userId);
      if (!period) {
        return res.status(404).json({ message: "Bonus period not found" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error approving bonus:", err);
      res.status(500).json({ message: "Failed to approve bonus" });
    }
  });

  app.post("/api/kpi/bonus/:id/pay", isAuthenticated, async (req, res) => {
    try {
      const period = await storage.markBonusPeriodPaid(req.params.id);
      if (!period) {
        return res.status(404).json({ message: "Bonus period not found" });
      }
      res.json(period);
    } catch (err: any) {
      console.error("Error marking bonus paid:", err);
      res.status(500).json({ message: "Failed to mark bonus paid" });
    }
  });

  app.get("/api/kpi/staff/:staffId/phase-log", isAuthenticated, async (req, res) => {
    try {
      const log = await storage.getPhaseLog(req.params.staffId);
      res.json(log);
    } catch (err: any) {
      console.error("Error fetching phase log:", err);
      res.status(500).json({ message: "Failed to fetch phase log" });
    }
  });

  app.post("/api/kpi/staff/:staffId/advance-phase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const { notes } = req.body;
      await storage.advanceSalesPhase(req.params.staffId, userId, notes);
      res.json({ success: true, message: "Sales phase advanced successfully" });
    } catch (err: any) {
      console.error("Error advancing sales phase:", err);
      res.status(500).json({ message: err.message || "Failed to advance sales phase" });
    }
  });

  app.get("/api/kpi/staff/:staffId/phase-checklist", isAuthenticated, async (req, res) => {
    try {
      const { fromPhase, toPhase } = req.query;
      const from = parseInt(fromPhase as string) || 1;
      const to = parseInt(toPhase as string) || 2;
      const checklist = await storage.getPhaseChecklist(req.params.staffId, from, to);
      res.json(checklist);
    } catch (err: any) {
      console.error("Error fetching phase checklist:", err);
      res.status(500).json({ message: "Failed to fetch phase checklist" });
    }
  });

  app.post("/api/kpi/phase-checklist/:id/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const item = await storage.togglePhaseChecklistItem(req.params.id, userId);
      if (!item) {
        return res.status(404).json({ message: "Checklist item not found" });
      }
      res.json(item);
    } catch (err: any) {
      console.error("Error toggling checklist item:", err);
      res.status(500).json({ message: "Failed to toggle checklist item" });
    }
  });
}
