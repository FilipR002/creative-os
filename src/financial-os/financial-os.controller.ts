import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags }                    from '@nestjs/swagger';
import { AutonomyService, AutonomyLevel }           from './autonomy.service';
import { CostTrackingService }                      from './cost-tracking.service';
import { ProfitOptimizerService }                   from './profit-optimizer.service';
import { AiCfoService }                             from './ai-cfo.service';
import { BudgetRebalancerService }                  from './budget-rebalancer.service';
import { RevenueForecastService }                   from './revenue-forecast.service';
import { ProfitLearningService }                    from './profit-learning.service';
import { AiCeoService }                             from './ai-ceo.service';
import { ProfitIntelligenceService }                from './profit-intelligence.service';

@ApiTags('Financial OS')
@Controller('api/financial-os')
export class FinancialOsController {
  constructor(
    private readonly autonomy:      AutonomyService,
    private readonly cost:          CostTrackingService,
    private readonly profit:        ProfitOptimizerService,
    private readonly cfo:           AiCfoService,
    private readonly budget:        BudgetRebalancerService,
    private readonly revenue:       RevenueForecastService,
    private readonly learning:      ProfitLearningService,
    private readonly ceo:           AiCeoService,
    private readonly intelligence:  ProfitIntelligenceService,
  ) {}

  // ── AUTONOMY ────────────────────────────────────────────────────────────────

  @Get('autonomy')
  @ApiOperation({ summary: 'Get current autonomy level + mode info' })
  getAutonomy() { return this.autonomy.getLevelInfo(); }

  @Post('autonomy')
  @ApiOperation({ summary: 'Set autonomy level (0–3)' })
  setAutonomy(@Body() body: { level: AutonomyLevel }) {
    return this.autonomy.setLevel(body.level);
  }

  // ── COST TRACKING ───────────────────────────────────────────────────────────

  @Get('cost/summary')
  @ApiOperation({ summary: 'Real-time cost summary: daily, monthly, all-time, by campaign/type' })
  getCostSummary() { return this.cost.getSummary(); }

  @Get('cost/events')
  @ApiOperation({ summary: 'Recent cost events (in-memory ring buffer)' })
  getCostEvents(@Query('limit') limit?: string) {
    return { events: this.cost.getRecentEvents(limit ? parseInt(limit, 10) : 100) };
  }

  @Get('cost/table')
  @ApiOperation({ summary: 'Cost table: price per operation type' })
  getCostTable() { return this.cost.getCostTable(); }

  // ── PROFIT OPTIMIZER ────────────────────────────────────────────────────────

  @Get('profit/zones')
  @ApiOperation({ summary: 'Campaign profit zones: SCALE / FIX / KILL with autonomy gate status' })
  getProfitZones() { return this.profit.getZones(); }

  @Post('profit/action')
  @ApiOperation({ summary: 'Execute profit action (gated by autonomy level)' })
  executeProfitAction(@Body() body: { campaignId: string; action: 'scale' | 'fix' | 'kill' }) {
    return this.profit.executeAction(body.campaignId, body.action);
  }

  @Get('profit/pending')
  @ApiOperation({ summary: 'List actions pending admin approval (Level 2)' })
  getPendingActions() { return { queue: this.profit.getPendingQueue() }; }

  @Post('profit/approve/:id')
  @ApiOperation({ summary: 'Approve a pending profit action' })
  approveAction(@Param('id') id: string) { return this.profit.approveAction(id); }

  @Post('profit/reject/:id')
  @ApiOperation({ summary: 'Reject a pending profit action' })
  rejectAction(@Param('id') id: string) { return this.profit.rejectAction(id); }

  @Get('profit/log')
  @ApiOperation({ summary: 'Action execution log with gate state at time of decision' })
  getActionLog() { return { log: this.profit.getActionLog() }; }

  // ── AI CFO ──────────────────────────────────────────────────────────────────

  @Get('cfo/forecast')
  @ApiOperation({ summary: 'AI CFO 30-day profit forecast with trend, risk factors, opportunities' })
  getCfoForecast(@Query('days') days?: string) {
    return this.cfo.getForecast(days ? parseInt(days, 10) : 30);
  }

  @Get('cfo/insights')
  @ApiOperation({ summary: 'AI CFO strategic insights from financial data' })
  getCfoInsights() { return this.cfo.getInsights(); }

  // ── BUDGET REBALANCER ────────────────────────────────────────────────────────

  @Get('budget/status')
  @ApiOperation({ summary: 'Current budget allocations + pending proposals + gate status' })
  getBudgetStatus() { return this.budget.getStatus(); }

  @Post('budget/rebalance')
  @ApiOperation({ summary: 'Trigger budget rebalance (gated by autonomy level)' })
  rebalance() { return this.budget.rebalance(); }

  @Get('budget/proposals')
  @ApiOperation({ summary: 'All rebalance proposals (pending, approved, rejected, applied)' })
  getProposals() { return { proposals: this.budget.getProposals() }; }

  @Post('budget/approve/:id')
  @ApiOperation({ summary: 'Approve a pending rebalance proposal (Level 2 flow)' })
  approveProposal(@Param('id') id: string) { return this.budget.approveProposal(id); }

  @Post('budget/reject/:id')
  @ApiOperation({ summary: 'Reject a pending rebalance proposal' })
  rejectProposal(@Param('id') id: string) { return this.budget.rejectProposal(id); }

  // ── REVENUE FORECASTING ──────────────────────────────────────────────────────

  @Get('revenue/forecast/:campaignId')
  @ApiOperation({ summary: 'Per-campaign revenue forecast: predicted, best/worst case, daily projection' })
  forecastCampaign(@Param('campaignId') id: string, @Query('days') days?: string) {
    return this.revenue.forecastCampaign(id, days ? parseInt(days, 10) : 30);
  }

  @Get('revenue/portfolio')
  @ApiOperation({ summary: 'Portfolio-wide revenue forecast aggregated across all active campaigns' })
  portfolioForecast(@Query('days') days?: string) {
    return this.revenue.portfolioForecast(days ? parseInt(days, 10) : 30);
  }

  // ── SELF-LEARNING PROFIT BRAIN ───────────────────────────────────────────────

  @Get('learning/profit/model')
  @ApiOperation({ summary: 'Current profit learning model: thresholds, accuracy, version' })
  getProfitModel() { return this.learning.getModel(); }

  @Get('learning/profit/insights')
  @ApiOperation({ summary: 'Discovered patterns from profit learning (high/low ROAS angles, fatigue, scaling)' })
  getLearningInsights() { return this.learning.getInsights(); }

  @Post('learning/profit/update')
  @ApiOperation({ summary: 'Trigger incremental learning cycle — updates model thresholds from real data' })
  runLearningCycle() { return this.learning.runLearningCycle(); }

  @Get('learning/profit/history')
  @ApiOperation({ summary: 'History of learning cycles with accuracy progression' })
  getLearningHistory() { return { cycles: this.learning.getCycleHistory() }; }

  // ── AI CEO ───────────────────────────────────────────────────────────────────

  @Get('ceo/portfolio')
  @ApiOperation({ summary: 'AI CEO portfolio view: all campaigns ranked by ROI with status and capital suggestion' })
  getCeoPortfolio() { return this.ceo.getPortfolio(); }

  @Get('ceo/strategy')
  @ApiOperation({ summary: 'AI CEO strategic decisions: quarter goal, budget priority, risk alerts' })
  getCeoStrategy() { return this.ceo.getStrategy(); }

  @Get('ceo/allocation')
  @ApiOperation({ summary: 'AI CEO capital allocation map: ideal vs current budget share per campaign' })
  getCapitalAllocation() { return this.ceo.getCapitalAllocation(); }

  // ── PROFIT INTELLIGENCE (Unit Economics) ─────────────────────────────────────

  @Get('intelligence/features')
  @ApiOperation({ summary: 'Feature-level profitability: cost, attributed revenue, ROI, margin per product feature' })
  getFeatureProfits() { return this.intelligence.getFeatureProfits(); }

  @Get('intelligence/summary')
  @ApiOperation({ summary: 'Overall profit summary with attribution confidence note' })
  getIntelligenceSummary() { return this.intelligence.getSummary(); }

  @Get('intelligence/unit-economics')
  @ApiOperation({ summary: 'Unit economics per feature: avg cost/use, avg revenue/use, profit/use' })
  getUnitEconomics() { return this.intelligence.getUnitEconomics(); }

  @Get('intelligence/trends')
  @ApiOperation({ summary: 'Profit trends over last 7 or 30 days' })
  getIntelligenceTrends(@Query('range') range?: '7d' | '30d') {
    return this.intelligence.getTrends(range ?? '7d');
  }
}
