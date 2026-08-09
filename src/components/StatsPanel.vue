<template>
  <div class="stats-wrapper">
    <header class="stats-header">
      <div class="stats-header-left">
        <el-icon :size="20" color="#6366f1"><DataLine /></el-icon>
        <h2 class="stats-title">数据统计</h2>
      </div>
      <el-button @click="$emit('close')" class="close-btn">
        <el-icon><Close /></el-icon> 返回
      </el-button>
    </header>

    <div class="stats-content" v-if="data">
      <!-- Graduation Year + Time Filter Bar -->
      <div class="time-filter-bar">
        <div class="time-filter-left">
          <el-icon :size="16" color="#6366f1"><Calendar /></el-icon>
          <span class="time-filter-label">毕业届</span>
        </div>
        <div class="stats-grad-seg">
          <button
            v-for="y in statsGradYearList"
            :key="y"
            class="stats-grad-btn"
            :class="{ 'stats-grad-active': statsGradYear === y }"
            @click="onGradYearChanged(y)"
          >{{ y }}届<span v-if="y === getCurrentGraduationYear()" class="stats-grad-current">当前</span></button>
          <button
            class="stats-grad-btn"
            :class="{ 'stats-grad-active': statsGradYear === 'all' }"
            @click="onGradYearChanged('all')"
          >全部届</button>
        </div>
      </div>
      <div class="time-filter-bar">
        <div class="time-filter-left">
          <el-icon :size="16" color="#6366f1"><Calendar /></el-icon>
          <span class="time-filter-label">统计范围</span>
        </div>
        <div class="time-filter-controls">
          <el-radio-group v-model="timeMode" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="year">按年</el-radio-button>
            <el-radio-button value="month">按月</el-radio-button>
          </el-radio-group>
          <el-select ref="yearSelectRef" v-if="timeMode !== 'all'" v-model="selectedYear" size="small" style="width: 100px" @change="onYearChanged">
            <el-option v-for="y in yearList" :key="y" :label="y + '年'" :value="y" />
          </el-select>
          <el-select ref="monthSelectRef" v-if="timeMode === 'month'" v-model="selectedMonth" size="small" style="width: 90px" @change="onMonthChanged">
            <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
          </el-select>
          <span class="time-filter-summary">
            {{ timeMode === 'all' ? '所有历史数据' : timeMode === 'year' ? selectedYear + '年全年' : selectedYear + '年' + selectedMonth + '月' }}
          </span>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-icon" style="background: #eef2ff; color: #6366f1;">
            <el-icon :size="22"><DataBoard /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">{{ data.totalOrders }}</div>
            <div class="kpi-label">总订单数</div>
            <div class="kpi-sub">已完成 {{ data.completedCount }} 单</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: #ecfdf5; color: #059669;">
            <el-icon :size="22"><Coin /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">¥{{ fmt(data.overall.totalRevenue) }}</div>
            <div class="kpi-label">总收入</div>
            <div class="kpi-sub">已收 ¥{{ fmt(data.overall.totalPaid) }}</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: #fef3c7; color: #d97706;">
            <el-icon :size="22"><Money /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">¥{{ fmt(data.overall.totalDispatch + data.overall.totalRefund) }}</div>
            <div class="kpi-label">总支出</div>
            <div class="kpi-sub">派单 ¥{{ fmt(data.overall.totalDispatch) }} / 退款 ¥{{ fmt(data.overall.totalRefund) }}</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" :style="{ background: netProfit >= 0 ? '#ecfdf5' : '#fff1f2', color: netProfit >= 0 ? '#059669' : '#e11d48' }">
            <el-icon :size="22"><TrendCharts /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value" :class="netProfit >= 0 ? 'text-green' : 'text-red'">¥{{ fmt(netProfit) }}</div>
            <div class="kpi-label">净利润</div>
            <div class="kpi-sub" v-if="data.thesisBalance > 0">待收尾款 ¥{{ fmt(data.thesisBalance) }}</div>
          </div>
        </div>
      </div>

      <!-- Charts Row: Status + Monthly Trend -->
      <div class="chart-row">
        <div class="chart-card">
          <h3 class="chart-title">订单状态分布</h3>
          <v-chart :option="statusChartOption" autoresize class="chart" />
        </div>
        <div class="chart-card">
          <h3 class="chart-title">{{ trendTitle }}</h3>
          <v-chart :option="trendChartOption" autoresize class="chart" />
        </div>
      </div>

      <!-- Charts Row 3: Rankings -->
      <div class="chart-row triple">
        <div class="chart-card">
          <h3 class="chart-title">接单人排行</h3>
          <v-chart :option="rankChart(data.byReceiver)" autoresize class="chart" />
        </div>
        <div class="chart-card">
          <h3 class="chart-title">处理人排行</h3>
          <v-chart :option="rankChart(data.byHandler)" autoresize class="chart" />
        </div>
        <div class="chart-card">
          <h3 class="chart-title">学校来源 Top 10</h3>
          <v-chart :option="rankChart(data.byUniversity)" autoresize class="chart" />
        </div>
      </div>

      <!-- Financial Detail Table -->
      <div class="chart-card table-card">
        <h3 class="chart-title">财务明细</h3>
        <div class="detail-grid">
          <div class="detail-header">
            <span>类型</span><span>全款总额</span><span>派单总额</span><span>退款总额</span><span>净收入</span>
          </div>
          <div v-for="t in typeRows" :key="t.type" class="detail-row">
            <span class="detail-type" :style="{ color: typeColorMap[t.type] }">{{ typeLabelMap[t.type] || t.type }}</span>
            <span>¥{{ fmt(t.revenue) }}</span>
            <span>¥{{ fmt(t.dispatch) }}</span>
            <span>¥{{ fmt(t.refund) }}</span>
            <span :class="(t.revenue - t.dispatch - t.refund) >= 0 ? 'text-green' : 'text-red'">
              ¥{{ fmt(t.revenue - t.dispatch - t.refund) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Handler Detail Section -->
      <div class="chart-card handler-detail-card">
        <div class="handler-detail-header">
          <h3 class="chart-title">处理人结算明细</h3>
          <el-select v-model="selectedHandler" placeholder="选择处理人" size="default" style="width: 160px;" @change="loadHandlerDetail">
            <el-option v-for="h in handlerList" :key="h" :label="h" :value="h" />
          </el-select>
        </div>

        <template v-if="handlerData">
          <!-- Handler KPI -->
          <div class="handler-kpi-row">
            <div class="handler-kpi kpi-clickable" :class="{ 'kpi-selected': kpiFilter === 'all' }" @click="toggleKpiFilter('all')">
              <div class="handler-kpi-val">{{ handlerData.total.orderCount }}</div>
              <div class="handler-kpi-label">总接单量</div>
              <div class="kpi-hint"><el-icon :size="12"><View /></el-icon>点击查看</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val">¥{{ fmt(handlerData.total.totalDispatch) }}</div>
              <div class="handler-kpi-label">应付总额</div>
            </div>
            <div class="handler-kpi kpi-clickable" :class="{ 'kpi-selected': kpiFilter === 'paid' }" @click="toggleKpiFilter('paid')">
              <div class="handler-kpi-val text-green">¥{{ fmt(handlerData.total.paidAmount) }}</div>
              <div class="handler-kpi-label">已支付 ({{ handlerData.total.paidCount }} 笔)</div>
              <div class="kpi-hint"><el-icon :size="12"><View /></el-icon>点击查看</div>
            </div>
            <div class="handler-kpi kpi-clickable" :class="{ 'kpi-selected': kpiFilter === 'unpaid' }" @click="toggleKpiFilter('unpaid')">
              <div class="handler-kpi-val text-red">¥{{ fmt(handlerData.total.unpaidAmount) }}</div>
              <div class="handler-kpi-label">未结算 ({{ handlerData.total.unpaidCount }} 笔)</div>
              <div class="kpi-hint"><el-icon :size="12"><View /></el-icon>点击查看</div>
            </div>
          </div>

          <!-- KPI filtered order list -->
          <div v-if="kpiFilter && kpiFilteredOrders.length > 0" class="kpi-order-list">
            <div class="kpi-order-list-header">
              <div class="kpi-order-list-left">
                <span>{{ kpiFilterLabel }} ({{ kpiFilteredOrders.length }})</span>
                <el-select
                  v-if="receiverListInHandler.length > 1"
                  v-model="selectedReceiverInHandler"
                  placeholder="全部接单人"
                  size="small"
                  clearable
                  style="width: 130px;"
                >
                  <el-option v-for="r in receiverListInHandler" :key="r" :label="r" :value="r" />
                </el-select>
                <el-select
                  v-if="handlerOrderTypeOptions.length > 1"
                  v-model="handlerOrderTypeFilter"
                  placeholder="全部类型"
                  size="small"
                  style="width: 130px;"
                >
                  <el-option label="全部类型" value="all" />
                  <el-option v-for="item in handlerOrderTypeOptions" :key="item" :label="typeLabelMap[item] || item" :value="item" />
                </el-select>
              </div>
              <el-button text size="small" @click="kpiFilter = ''">收起</el-button>
            </div>
            <div v-if="handlerOrderSummary" class="receiver-summary-bar">
              <span v-if="selectedReceiverInHandler" class="receiver-summary-name">{{ selectedReceiverInHandler }}</span>
              <span class="receiver-summary-item">
                {{ kpiFilterLabel }} <strong>{{ handlerOrderSummary.count }}</strong> 笔
              </span>
              <span class="receiver-summary-item">
                总金额 <strong>¥{{ fmt(handlerOrderSummary.totalAmount) }}</strong>
              </span>
              <span class="receiver-summary-item">
                已付 <strong class="text-green">¥{{ fmt(handlerOrderSummary.paidAmount) }}</strong>
              </span>
              <span class="receiver-summary-item">
                未结 <strong class="text-red">¥{{ fmt(handlerOrderSummary.unpaidAmount) }}</strong>
              </span>
            </div>
            <div class="week-orders">
              <div class="week-order-header" :class="kpiFilter === 'unpaid' ? 'handler-order-6col' : 'handler-order-5col'">
                <template v-if="kpiFilter === 'unpaid'">
                  <span>订单名称</span><span>接单人</span><span>类型</span><span>总金额</span><span>已付金额</span><span>未结金额</span>
                </template>
                <template v-else>
                  <span>订单名称</span><span>接单人</span><span>类型</span><span>派单金额</span><span>状态</span>
                </template>
              </div>
              <div
                v-for="o in kpiFilteredOrders"
                :key="o.id"
                class="week-order-row"
                :class="kpiFilter === 'unpaid' ? 'handler-order-6col' : 'handler-order-5col'"
                @click="$emit('navigate-order', o.id)"
              >
                <span class="week-order-title">{{ o.title }}</span>
                <span class="receiver-tag">{{ o.receiver || '本人' }}</span>
                <span :style="{ color: typeColorMap[o.orderType] }">{{ typeLabelMap[o.orderType] || o.orderType }}</span>
                <template v-if="kpiFilter === 'unpaid'">
                  <span>¥{{ fmt(o.dispatchAmount) }}</span>
                  <span class="text-green">¥{{ fmt(o.handlerPaidAmount) }}</span>
                  <span class="text-red">¥{{ fmt((o.dispatchAmount || 0) - (o.handlerPaidAmount || 0)) }}</span>
                </template>
                <template v-else>
                  <span>¥{{ fmt(o.dispatchAmount) }}</span>
                  <el-tag :type="(o.handlerPaidAmount || 0) >= (o.dispatchAmount || 0) && o.dispatchAmount > 0 ? 'success' : 'warning'" size="small" effect="plain">
                    {{ (o.handlerPaidAmount || 0) >= (o.dispatchAmount || 0) && o.dispatchAmount > 0 ? '已结清' : '已付¥' + fmt(o.handlerPaidAmount || 0) }}
                  </el-tag>
                </template>
              </div>
            </div>
          </div>

          <!-- Week navigator -->
          <div class="week-nav">
            <el-button text @click="changeWeek(1)" :disabled="loadingWeek">
              <el-icon><ArrowLeft /></el-icon> 上一周
            </el-button>
            <span class="week-label">{{ handlerData.week.label }}</span>
            <el-button text @click="changeWeek(-1)" :disabled="weekOffset <= 0 || loadingWeek">
              下一周 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>

          <!-- Week summary -->
          <div class="week-summary">
            <div class="week-stat">
              <span class="week-stat-label">本周接单</span>
              <span class="week-stat-val">{{ handlerData.week.orderCount }} 单</span>
            </div>
            <div class="week-stat">
              <span class="week-stat-label">本周应付</span>
              <span class="week-stat-val">¥{{ fmt(handlerData.week.totalDispatch) }}</span>
            </div>
            <div class="week-stat">
              <span class="week-stat-label">本周已付</span>
              <span class="week-stat-val text-green">¥{{ fmt(handlerData.week.paidAmount) }}</span>
            </div>
            <div class="week-stat">
              <span class="week-stat-label">本周未结</span>
              <span class="week-stat-val text-red">¥{{ fmt(handlerData.week.unpaidAmount) }}</span>
            </div>
          </div>

          <!-- Week orders list -->
          <div v-if="handlerData.week.orders.length > 0" class="week-orders">
            <div class="week-order-header">
              <span>订单名称</span><span>类型</span><span>派单金额</span><span>状态</span>
            </div>
            <div v-for="o in handlerData.week.orders" :key="o.id" class="week-order-row" @click="$emit('navigate-order', o.id)">
              <span class="week-order-title">{{ o.title }}</span>
              <span :style="{ color: typeColorMap[o.orderType] }">{{ typeLabelMap[o.orderType] || o.orderType }}</span>
              <span>¥{{ fmt(o.dispatchAmount) }}</span>
              <el-tag :type="(o.handlerPaidAmount || 0) >= (o.dispatchAmount || 0) && o.dispatchAmount > 0 ? 'success' : 'warning'" size="small" effect="plain">
                {{ (o.handlerPaidAmount || 0) >= (o.dispatchAmount || 0) && o.dispatchAmount > 0 ? '已结清' : '已付¥' + fmt(o.handlerPaidAmount || 0) }}
              </el-tag>
            </div>
          </div>
          <div v-else class="week-empty">本周暂无订单记录</div>
        </template>

        <div v-else class="handler-placeholder">
          <el-icon :size="28" color="#cbd5e1"><User /></el-icon>
          <span>请选择处理人查看详细结算数据</span>
        </div>
      </div>

      <!-- Receiver Detail Section -->
      <div class="chart-card receiver-detail-card">
        <div class="handler-detail-header">
          <h3 class="chart-title">接单人结算统计</h3>
          <el-select v-model="selectedReceiver" placeholder="选择接单人" size="default" style="width: 160px;" clearable @change="loadReceiverDetail">
            <el-option v-for="r in receiverList" :key="r" :label="r" :value="r" />
          </el-select>
        </div>

        <template v-if="receiverData">
          <!-- Receiver KPI -->
          <div class="handler-kpi-row receiver-kpi-row">
            <div class="handler-kpi">
              <div class="handler-kpi-val">{{ receiverData.total.orderCount }}</div>
              <div class="handler-kpi-label">总接单量</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val">¥{{ fmt(receiverData.total.totalAmount) }}</div>
              <div class="handler-kpi-label">总订单额</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val text-green">¥{{ fmt(receiverData.total.paidAmount) }}</div>
              <div class="handler-kpi-label">已收金额 ({{ receiverData.total.paidCount }} 笔)</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val text-red">¥{{ fmt(receiverData.total.unpaidAmount) }}</div>
              <div class="handler-kpi-label">未收尾款 ({{ receiverData.total.unpaidCount }} 笔)</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val">¥{{ fmt(receiverData.total.totalDispatch) }}</div>
              <div class="handler-kpi-label">派单成本</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val">¥{{ fmt(receiverData.total.refundAmount) }}</div>
              <div class="handler-kpi-label">退款金额</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val" :class="receiverData.total.expectedProfit >= 0 ? 'text-green' : 'text-red'">¥{{ fmt(receiverData.total.expectedProfit) }}</div>
              <div class="handler-kpi-label">预计利润</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val" :class="receiverData.total.actualProfit >= 0 ? 'text-green' : 'text-red'">¥{{ fmt(receiverData.total.actualProfit) }}</div>
              <div class="handler-kpi-label">实收利润</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val text-green">¥{{ fmt(receiverData.total.settledProfit) }}</div>
              <div class="handler-kpi-label">已结算利润</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val text-red">¥{{ fmt(receiverData.total.unsettledProfit) }}</div>
              <div class="handler-kpi-label">待结算利润</div>
            </div>
          </div>

          <!-- Receiver Profit Detail -->
          <div v-if="receiverProfitOrders.length > 0" class="receiver-profit-detail">
            <div class="receiver-unsettled-head">
              <h4 class="sub-section-title">利润明细 ({{ receiverProfitOrders.length }})</h4>
              <div class="receiver-profit-actions">
                <span class="receiver-profit-selected">已选 {{ selectedReceiverProfitOrderIds.length }} 单 / ¥{{ fmt(selectedReceiverSettlementAmount) }}</span>
                <el-button size="small" @click="selectAllReceiverProfitOrders">全选待结算</el-button>
                <el-button size="small" @click="clearReceiverProfitSelection">清空</el-button>
                <el-button type="primary" size="small" :disabled="selectedReceiverSettlementAmount <= 0" @click="createReceiverSettlement">新增结算</el-button>
              </div>
            </div>

            <div class="week-orders receiver-profit-table">
              <div class="week-order-header receiver-profit-12col">
                <span>选择</span><span>订单编号</span><span>订单名称</span><span>类型</span><span>处理人</span><span>订单额</span><span>已收</span><span>派单</span><span>退款</span><span>实收利润</span><span>已结算</span><span>待结算</span>
              </div>
              <div
                v-for="o in receiverProfitOrders"
                :key="o.id"
                class="week-order-row receiver-profit-12col"
                @click="$emit('navigate-order', o.id)"
              >
                <span @click.stop>
                  <input
                    type="checkbox"
                    :disabled="(o.unsettledProfit || 0) <= 0"
                    :checked="selectedReceiverProfitOrderIds.includes(o.id)"
                    @change="toggleReceiverProfitOrder(o.id)"
                  />
                </span>
                <span>{{ o.orderCode || '—' }}</span>
                <span class="week-order-title">{{ o.title }}</span>
                <span :style="{ color: typeColorMap[o.orderType] }">{{ typeLabelMap[o.orderType] || o.orderType }}</span>
                <span>{{ o.handler || '本人' }}</span>
                <span>¥{{ fmt(o.totalAmount) }}</span>
                <span class="text-green">¥{{ fmt(o.paidAmount) }}</span>
                <span>¥{{ fmt(o.dispatchAmount) }}</span>
                <span>¥{{ fmt(o.refundAmount) }}</span>
                <span :class="(o.actualProfit || 0) >= 0 ? 'text-green' : 'text-red'">¥{{ fmt(o.actualProfit) }}</span>
                <span>¥{{ fmt(o.settledAmount) }}</span>
                <span class="text-red">¥{{ fmt(o.unsettledProfit) }}</span>
              </div>
            </div>
          </div>

          <!-- By Handler Breakdown -->
          <div v-if="receiverData.byHandler && receiverData.byHandler.length > 0" class="receiver-handler-table">
            <h4 class="sub-section-title">关联处理人分布</h4>
            <div class="week-orders">
              <div class="week-order-header receiver-handler-5col">
                <span>处理人</span><span>订单数</span><span>派单总额</span><span>已付</span><span>未结</span>
              </div>
              <div v-for="h in receiverData.byHandler" :key="h.name" class="week-order-row receiver-handler-5col">
                <span class="week-order-title">{{ h.name }}</span>
                <span>{{ h.orderCount }} 单</span>
                <span>¥{{ fmt(h.totalDispatch) }}</span>
                <span class="text-green">¥{{ fmt(h.paidAmount) }}</span>
                <span class="text-red">¥{{ fmt(h.unpaidAmount) }}</span>
              </div>
            </div>
          </div>

          <!-- Unsettled Orders -->
          <div v-if="receiverUnsettledOrders.length > 0" class="receiver-unsettled">
            <div class="receiver-unsettled-head">
              <h4 class="sub-section-title">未结算订单明细 ({{ filteredReceiverUnsettledOrders.length }})</h4>
              <el-select
                v-model="receiverUnsettledTypeFilter"
                placeholder="全部类型"
                size="small"
                class="receiver-unsettled-type-filter"
              >
                <el-option label="全部类型" value="all" />
                <el-option
                  v-for="item in receiverUnsettledTypeOptions"
                  :key="item"
                  :label="typeLabelMap[item] || item"
                  :value="item"
                />
              </el-select>
            </div>

            <div class="receiver-unsettled-summary">
              <div class="receiver-unsettled-summary-card">
                <span class="receiver-unsettled-summary-label">总金额</span>
                <strong class="receiver-unsettled-summary-value">¥{{ fmt(receiverUnsettledSummary.totalAmount) }}</strong>
              </div>
              <div class="receiver-unsettled-summary-card">
                <span class="receiver-unsettled-summary-label">已付金额</span>
                <strong class="receiver-unsettled-summary-value text-green">¥{{ fmt(receiverUnsettledSummary.paidAmount) }}</strong>
              </div>
              <div class="receiver-unsettled-summary-card">
                <span class="receiver-unsettled-summary-label">未结金额</span>
                <strong class="receiver-unsettled-summary-value text-red">¥{{ fmt(receiverUnsettledSummary.unpaidAmount) }}</strong>
              </div>
            </div>

            <div class="week-orders">
              <div class="week-order-header receiver-unsettled-6col">
                <span>订单名称</span><span>类型</span><span>处理人</span><span>总金额</span><span>已付金额</span><span>未结金额</span>
              </div>
              <div v-for="o in filteredReceiverUnsettledOrders" :key="o.id" class="week-order-row receiver-unsettled-6col" @click="$emit('navigate-order', o.id)">
                <span class="week-order-title">{{ o.title }}</span>
                <span :style="{ color: typeColorMap[o.orderType] }">{{ typeLabelMap[o.orderType] || o.orderType }}</span>
                <span>{{ o.handler || '本人' }}</span>
                <span>¥{{ fmt(o.totalAmount) }}</span>
                <span class="text-green">¥{{ fmt(o.paidAmount) }}</span>
                <span class="text-red">¥{{ fmt((o.totalAmount || 0) - (o.paidAmount || 0)) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="week-empty">该接单人名下无未结算订单</div>

          <div class="receiver-settlement-history">
            <h4 class="sub-section-title">利润结算记录 ({{ receiverData.settlements?.length || 0 }})</h4>
            <div v-if="receiverData.settlements && receiverData.settlements.length > 0" class="week-orders">
              <div class="week-order-header receiver-settlement-7col">
                <span>时间</span><span>状态</span><span>订单数</span><span>结算金额</span><span>实收利润快照</span><span>备注</span><span>操作</span>
              </div>
              <div v-for="s in receiverData.settlements" :key="s.id" class="week-order-row receiver-settlement-7col">
                <span>{{ formatDateTime(s.createdAt) }}</span>
                <span>
                  <el-tag :type="s.status === 'active' ? 'success' : 'info'" size="small" effect="plain">
                    {{ s.status === 'active' ? '有效' : '已作废' }}
                  </el-tag>
                </span>
                <span>{{ s.itemCount || s.orderCount || 0 }} 单</span>
                <span class="text-green">¥{{ fmt(s.amount) }}</span>
                <span>¥{{ fmt(s.actualProfitSnapshot) }}</span>
                <span class="week-order-title">{{ s.note || '—' }}</span>
                <span>
                  <el-button v-if="s.status === 'active'" text size="small" type="danger" @click="voidReceiverSettlement(s.id)">作废</el-button>
                  <span v-else>—</span>
                </span>
              </div>
            </div>
            <div v-else class="week-empty">暂无利润结算记录</div>
          </div>
        </template>

        <div v-else class="handler-placeholder">
          <el-icon :size="28" color="#cbd5e1"><User /></el-icon>
          <span>请选择接单人查看结算统计</span>
        </div>
      </div>

      <div style="height: 40px" />
    </div>

    <div v-else class="stats-loading">
      <el-icon :size="32" class="loading-spin"><Loading /></el-icon>
      <span>加载统计数据...</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { ElMessage, ElMessageBox } from 'element-plus'

use([CanvasRenderer, PieChart, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

defineEmits(['close', 'navigate-order'])
const api = window.electronAPI
const currentUser = inject('currentUser')
const data = ref(null)

const typeLabelMap = {
  thesis: '毕设论文',
  format: '格式修改',
  translation: '外文翻译',
  design: '设计定制',
  reduction: '论文降重',
  special: '特殊订单',
}
const typeColorMap = {
  thesis: '#6366f1',
  format: '#0ea5e9',
  translation: '#f59e0b',
  design: '#8b5cf6',
  reduction: '#10b981',
  special: '#ef4444',
}

const timeMode = ref('all')
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const yearList = ref([])

function getCurrentGraduationYear() {
  const now = new Date()
  return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
}
const statsGradYear = ref(getCurrentGraduationYear())
const statsGradYearList = ref([])

function getStatsParams() {
  const base = { userId: currentUser.value?.id }
  if (statsGradYear.value !== 'all') base.graduationYear = statsGradYear.value
  if (timeMode.value === 'year') return { ...base, year: selectedYear.value }
  if (timeMode.value === 'month') return { ...base, year: selectedYear.value, month: selectedMonth.value }
  return base
}

function onGradYearChanged(val) {
  statsGradYear.value = val
  selectedHandler.value = ''
  handlerData.value = null
  selectedReceiver.value = ''
  receiverData.value = null
  kpiFilter.value = ''
  loadStats()
}

async function loadStats() {
  if (!currentUser.value || !currentUser.value.id) return
  data.value = await api.getStats(getStatsParams())
  if (selectedReceiver.value) await loadReceiverDetail()
}

const yearSelectRef = ref(null)
const monthSelectRef = ref(null)

function onYearChanged() {
  yearSelectRef.value?.blur()
  loadStats()
}
function onMonthChanged() {
  monthSelectRef.value?.blur()
  loadStats()
}

watch(timeMode, (val) => {
  loadStats()
})

const trendTitle = computed(() => {
  if (data.value && data.value.trendMode === 'daily') return '每日趋势'
  return '月度趋势'
})

const selectedHandler = ref('')
const handlerData = ref(null)
const weekOffset = ref(0)
const loadingWeek = ref(false)

const handlerList = computed(() => {
  if (!data.value) return []
  return data.value.byHandler.map(h => h.name)
})

const kpiFilter = ref('')

const kpiFilterLabel = computed(() => {
  if (kpiFilter.value === 'all') return '全部订单'
  if (kpiFilter.value === 'paid') return '已结清订单'
  if (kpiFilter.value === 'unpaid') return '未结算订单'
  return ''
})

const selectedReceiverInHandler = ref('')
const handlerOrderTypeFilter = ref('all')

const receiverListInHandler = computed(() => {
  if (!handlerData.value) return []
  const set = new Set((handlerData.value.allOrders || []).map(o => o.receiver || '本人'))
  return Array.from(set)
})

const handlerOrderTypeOptions = computed(() => {
  if (!handlerData.value || !kpiFilter.value) return []
  let orders = handlerData.value.allOrders || []
  if (selectedReceiverInHandler.value) {
    orders = orders.filter(o => (o.receiver || '本人') === selectedReceiverInHandler.value)
  }
  const set = new Set(orders.map(o => o.orderType || 'thesis'))
  return Array.from(set).sort((a, b) => (typeLabelMap[a] || a).localeCompare(typeLabelMap[b] || b, 'zh-CN'))
})

const kpiFilteredOrders = computed(() => {
  if (!handlerData.value || !kpiFilter.value) return []
  let orders = handlerData.value.allOrders || []
  if (selectedReceiverInHandler.value) {
    orders = orders.filter(o => (o.receiver || '本人') === selectedReceiverInHandler.value)
  }
  if (handlerOrderTypeFilter.value !== 'all') {
    orders = orders.filter(o => (o.orderType || 'thesis') === handlerOrderTypeFilter.value)
  }
  if (kpiFilter.value === 'all') return orders
  if (kpiFilter.value === 'paid') return orders.filter(o => o.dispatchAmount > 0 && (o.handlerPaidAmount || 0) >= o.dispatchAmount)
  if (kpiFilter.value === 'unpaid') return orders.filter(o => o.dispatchAmount > 0 && (o.handlerPaidAmount || 0) < o.dispatchAmount)
  return []
})

const handlerOrderSummary = computed(() => {
  if (!kpiFilter.value) return null
  const orders = kpiFilteredOrders.value
  const totalAmount = orders.reduce((s, o) => s + (Number(o.dispatchAmount) || 0), 0)
  const paidAmount = orders.reduce((s, o) => s + (Number(o.handlerPaidAmount) || 0), 0)
  return {
    count: orders.length,
    totalAmount,
    paidAmount,
    unpaidAmount: totalAmount - paidAmount,
  }
})

function toggleKpiFilter(type) {
  kpiFilter.value = kpiFilter.value === type ? '' : type
  if (!kpiFilter.value) handlerOrderTypeFilter.value = 'all'
}

watch(selectedReceiverInHandler, () => {
  handlerOrderTypeFilter.value = 'all'
})

async function loadHandlerDetail() {
  if (!selectedHandler.value || !currentUser.value || !currentUser.value.id) {
    handlerData.value = null
    handlerOrderTypeFilter.value = 'all'
    return
  }
  weekOffset.value = 0
  kpiFilter.value = ''
  selectedReceiverInHandler.value = ''
  handlerOrderTypeFilter.value = 'all'
  const gradYear = statsGradYear.value === 'all' ? null : statsGradYear.value
  handlerData.value = await api.getHandlerDetail(currentUser.value.id, selectedHandler.value, 0, gradYear)
}

async function changeWeek(dir) {
  if (!currentUser.value || !currentUser.value.id) return
  loadingWeek.value = true
  weekOffset.value += dir
  if (weekOffset.value < 0) weekOffset.value = 0
  const gradYear = statsGradYear.value === 'all' ? null : statsGradYear.value
  handlerData.value = await api.getHandlerDetail(currentUser.value.id, selectedHandler.value, weekOffset.value, gradYear)
  loadingWeek.value = false
}

// --- Receiver Detail ---
const selectedReceiver = ref('')
const receiverData = ref(null)
const receiverUnsettledTypeFilter = ref('all')
const selectedReceiverProfitOrderIds = ref([])

const receiverList = computed(() => {
  if (!data.value) return []
  return data.value.allReceivers || data.value.byReceiver.map(r => r.name)
})

const receiverUnsettledOrders = computed(() => {
  if (!receiverData.value) return []
  return (receiverData.value.allOrders || []).filter(o => (o.totalAmount || 0) > 0 && (o.paidAmount || 0) < (o.totalAmount || 0))
})

const receiverUnsettledTypeOptions = computed(() => {
  const set = new Set(receiverUnsettledOrders.value.map(o => o.orderType || 'thesis'))
  return Array.from(set).sort((a, b) => (typeLabelMap[a] || a).localeCompare(typeLabelMap[b] || b, 'zh-CN'))
})

const filteredReceiverUnsettledOrders = computed(() => {
  if (receiverUnsettledTypeFilter.value === 'all') return receiverUnsettledOrders.value
  return receiverUnsettledOrders.value.filter(o => (o.orderType || 'thesis') === receiverUnsettledTypeFilter.value)
})

const receiverUnsettledSummary = computed(() => {
  return filteredReceiverUnsettledOrders.value.reduce((summary, order) => {
    const totalAmount = Number(order.totalAmount) || 0
    const paidAmount = Number(order.paidAmount) || 0
    summary.totalAmount += totalAmount
    summary.paidAmount += paidAmount
    summary.unpaidAmount += Math.max(totalAmount - paidAmount, 0)
    return summary
  }, { totalAmount: 0, paidAmount: 0, unpaidAmount: 0 })
})

const receiverProfitOrders = computed(() => receiverData.value?.allOrders || [])

const selectedReceiverSettlementAmount = computed(() => {
  const selected = new Set(selectedReceiverProfitOrderIds.value)
  return receiverProfitOrders.value.reduce((sum, order) => {
    return selected.has(order.id) ? sum + (Number(order.unsettledProfit) || 0) : sum
  }, 0)
})

function toggleReceiverProfitOrder(orderId) {
  const current = selectedReceiverProfitOrderIds.value
  if (current.includes(orderId)) {
    selectedReceiverProfitOrderIds.value = current.filter(id => id !== orderId)
  } else {
    selectedReceiverProfitOrderIds.value = [...current, orderId]
  }
}

function selectAllReceiverProfitOrders() {
  selectedReceiverProfitOrderIds.value = receiverProfitOrders.value
    .filter(order => (Number(order.unsettledProfit) || 0) > 0)
    .map(order => order.id)
}

function clearReceiverProfitSelection() {
  selectedReceiverProfitOrderIds.value = []
}

function getCurrentStatsPeriod() {
  if (timeMode.value === 'month') {
    const m = String(selectedMonth.value).padStart(2, '0')
    const nextMonth = selectedMonth.value === 12 ? 1 : selectedMonth.value + 1
    const nextYear = selectedMonth.value === 12 ? selectedYear.value + 1 : selectedYear.value
    return {
      periodStart: `${selectedYear.value}-${m}-01`,
      periodEnd: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
    }
  }
  if (timeMode.value === 'year') {
    return {
      periodStart: `${selectedYear.value}-01-01`,
      periodEnd: `${selectedYear.value + 1}-01-01`,
    }
  }
  return { periodStart: '', periodEnd: '' }
}

async function createReceiverSettlement() {
  if (!selectedReceiver.value || !currentUser.value?.id) return
  if (selectedReceiverSettlementAmount.value <= 0) {
    ElMessage.warning('请先选择有待结算利润的订单')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将为「${selectedReceiver.value}」结算 ${selectedReceiverProfitOrderIds.value.length} 单，金额 ¥${fmt(selectedReceiverSettlementAmount.value)}。确认后会生成利润结算记录。`,
      '新增接单人利润结算',
      { type: 'warning', confirmButtonText: '确认结算', cancelButtonText: '取消' }
    )
    const period = getCurrentStatsPeriod()
    const result = await api.createReceiverProfitSettlement({
      userId: currentUser.value.id,
      receiver: selectedReceiver.value,
      orderIds: selectedReceiverProfitOrderIds.value,
      graduationYear: statsGradYear.value === 'all' ? 0 : statsGradYear.value,
      ...period,
    })
    if (!result?.success) {
      const errorTextMap = {
        INVALID_PARAMS: '结算参数不完整',
        NO_SETTLE_AMOUNT: '当前选中订单没有可结算利润',
      }
      ElMessage.error(errorTextMap[result?.error] || result?.error || '结算失败')
      return
    }
    ElMessage.success(`已生成结算记录：¥${fmt(result.amount)}`)
    clearReceiverProfitSelection()
    await loadReceiverDetail()
  } catch {}
}

async function voidReceiverSettlement(settlementId) {
  if (!currentUser.value?.id) return
  try {
    await ElMessageBox.confirm(
      '作废后该结算金额会重新计入待结算利润，历史记录会保留。确定作废？',
      '作废利润结算',
      { type: 'warning', confirmButtonText: '确认作废', cancelButtonText: '取消' }
    )
    const result = await api.voidReceiverProfitSettlement(currentUser.value.id, settlementId)
    if (!result?.success) {
      ElMessage.error(result?.error || '作废失败')
      return
    }
    ElMessage.success('已作废结算记录')
    await loadReceiverDetail()
  } catch {}
}

async function loadReceiverDetail() {
  if (!selectedReceiver.value || !currentUser.value || !currentUser.value.id) {
    receiverData.value = null
    receiverUnsettledTypeFilter.value = 'all'
    clearReceiverProfitSelection()
    return
  }
  receiverUnsettledTypeFilter.value = 'all'
  clearReceiverProfitSelection()
  receiverData.value = await api.getReceiverDetail({ ...getStatsParams(), receiver: selectedReceiver.value })
}

onMounted(async () => {
  if (!currentUser.value || !currentUser.value.id) return
  const years = await api.getStatsYears(currentUser.value.id)
  if (years.length > 0) yearList.value = years
  else yearList.value = [new Date().getFullYear()]
  const gradYears = await api.getGraduationYears(currentUser.value.id)
  const current = getCurrentGraduationYear()
  if (!gradYears.includes(current)) gradYears.push(current)
  gradYears.sort((a, b) => b - a)
  statsGradYearList.value = gradYears
  await loadStats()
})

function fmt(n) { return (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

const netProfit = computed(() => {
  if (!data.value) return 0
  const o = data.value.overall
  return o.totalRevenue - o.totalDispatch - o.totalRefund
})

const typeRows = computed(() => {
  if (!data.value) return []
  return data.value.byType.map(t => ({
    type: t.orderType,
    revenue: t.revenue || 0,
    dispatch: t.dispatch || 0,
    refund: t.refund || 0,
  }))
})

const typeChartOption = computed(() => {
  if (!data.value) return {}
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    color: Object.values(typeColorMap),
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: data.value.byType.map(t => ({
        name: typeLabelMap[t.orderType] || t.orderType,
        value: t.count,
      })),
    }],
  }
})

const revenueChartOption = computed(() => {
  if (!data.value) return {}
  const types = data.value.byType
  return {
    tooltip: { trigger: 'axis', formatter: (p) => p.map(i => `${i.seriesName}: ¥${(i.value || 0).toLocaleString()}`).join('<br/>') },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: types.map(t => typeLabelMap[t.orderType] || t.orderType), axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: '¥{value}' } },
    color: ['#6366f1', '#f59e0b', '#ef4444'],
    series: [
      { name: '全款', type: 'bar', data: types.map(t => t.revenue || 0), barWidth: 20, itemStyle: { borderRadius: [4, 4, 0, 0] } },
      { name: '派单', type: 'bar', data: types.map(t => t.dispatch || 0), barWidth: 20, itemStyle: { borderRadius: [4, 4, 0, 0] } },
      { name: '退款', type: 'bar', data: types.map(t => t.refund || 0), barWidth: 20, itemStyle: { borderRadius: [4, 4, 0, 0] } },
    ],
  }
})

const statusChartOption = computed(() => {
  if (!data.value) return {}
  const items = data.value.byStatus || []
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    yAxis: { type: 'category', data: items.map(i => typeLabelMap[i.orderType] || i.orderType), axisLabel: { fontSize: 12 } },
    color: ['#f59e0b', '#10b981'],
    series: [
      { name: '待提交', type: 'bar', stack: 'total', data: items.map(i => i.draftPending), itemStyle: { borderRadius: [0, 0, 0, 0] } },
      { name: '已提交', type: 'bar', stack: 'total', data: items.map(i => i.draftDone), itemStyle: { borderRadius: [0, 4, 4, 0] } },
    ],
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
  }
})

const trendChartOption = computed(() => {
  if (!data.value) return {}
  const trend = data.value.monthlyTrend || []
  const isDaily = data.value.trendMode === 'daily'
  const labels = isDaily ? trend.map(t => t.day + '日') : trend.map(t => t.month)
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 40, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11, rotate: isDaily ? 45 : 0 } },
    yAxis: [
      { type: 'value', name: '订单数', axisLabel: { fontSize: 11 }, nameTextStyle: { fontSize: 11 } },
      { type: 'value', name: '收入(¥)', axisLabel: { fontSize: 11, formatter: '¥{value}' }, nameTextStyle: { fontSize: 11 } },
    ],
    color: ['#6366f1', '#10b981'],
    series: [
      { name: '订单数', type: 'bar', data: trend.map(t => t.count), barWidth: isDaily ? 12 : 18, itemStyle: { borderRadius: [4, 4, 0, 0] } },
      { name: '收入', type: 'line', yAxisIndex: 1, data: trend.map(t => t.revenue || 0), smooth: true, lineStyle: { width: 2.5 }, symbolSize: 6 },
    ],
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
  }
})

function rankChart(items) {
  if (!items || items.length === 0) return {}
  const sorted = [...items].reverse()
  return {
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}: ${p[0].value} 单` },
    grid: { left: 80, right: 30, top: 10, bottom: 10 },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', data: sorted.map(i => i.name), axisLabel: { fontSize: 12 } },
    color: ['#6366f1'],
    series: [{
      type: 'bar',
      data: sorted.map(i => i.count),
      barWidth: 16,
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', fontSize: 11, formatter: '{c} 单' },
    }],
  }
}
</script>

<style scoped>
.stats-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stats-header {
  height: var(--gt-topbar-height);
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 var(--gt-page-pad);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.stats-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stats-title {
  font-size: var(--gt-title-lg);
  font-weight: 700;
  color: #1e293b;
}
.close-btn {
  border-radius: 8px !important;
}

.stats-content {
  flex: 1;
  overflow-y: auto;
  padding: calc(var(--gt-page-pad-y) - 4px) var(--gt-page-pad);
}

/* Time Filter */
.time-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.time-filter-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-filter-label {
  font-size: var(--gt-text-sm);
  font-weight: 600;
  color: #334155;
}
.stats-grad-seg {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.stats-grad-btn {
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  border-radius: 16px;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.stats-grad-btn:hover {
  color: #4f46e5;
  border-color: #c7d2fe;
  background: #eef2ff;
}
.stats-grad-active {
  background: #4f46e5;
  color: #fff;
  border-color: #4f46e5;
}
.stats-grad-active:hover {
  background: #4338ca;
  color: #fff;
  border-color: #4338ca;
}
.stats-grad-current {
  font-size: 10px;
  background: rgba(255,255,255,0.25);
  padding: 0 4px;
  border-radius: 4px;
  line-height: 1.4;
}
.stats-grad-active .stats-grad-current {
  background: rgba(255,255,255,0.3);
}
.time-filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}
.time-filter-summary {
  font-size: var(--gt-text-sm);
  color: #6366f1;
  font-weight: 500;
  background: #eef2ff;
  padding: 4px 12px;
  border-radius: 6px;
}

/* KPI */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: var(--gt-card-gap);
}
.kpi-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: var(--gt-card-pad);
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.kpi-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.kpi-value {
  font-size: var(--gt-title-xl);
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}
.kpi-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}
.kpi-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

/* Charts */
.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.chart-row.triple {
  grid-template-columns: 1fr 1fr 1fr;
}
.chart-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: var(--gt-card-pad);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.chart-title {
  font-size: var(--gt-text-sm);
  font-weight: 600;
  color: #334155;
  margin-bottom: 12px;
}
.chart {
  width: 100%;
  height: 240px;
}

/* Table */
.table-card {
  margin-bottom: 16px;
}
.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.detail-header, .detail-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  gap: 12px;
  padding: 10px 16px;
  font-size: 13px;
}
.detail-header {
  background: #f8fafc;
  border-radius: 8px;
  font-weight: 600;
  color: #64748b;
}
.detail-row {
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  font-weight: 500;
}
.detail-type {
  font-weight: 600;
}
.text-green { color: #059669; }
.text-red { color: #e11d48; }

/* Handler Detail */
.handler-detail-card {
  margin-bottom: 16px;
}
.handler-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.handler-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.receiver-kpi-row {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.handler-kpi {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  text-align: center;
}
.handler-kpi:nth-child(1) { background: #eef2ff; border-color: #c7d2fe; }
.handler-kpi:nth-child(2) { background: #f0f9ff; border-color: #bae6fd; }
.handler-kpi:nth-child(3) { background: #ecfdf5; border-color: #a7f3d0; }
.handler-kpi:nth-child(4) { background: #fff1f2; border-color: #fecdd3; }
.receiver-kpi-row .handler-kpi:nth-child(5) { background: #fff7ed; border-color: #fed7aa; }
.receiver-kpi-row .handler-kpi:nth-child(6) { background: #fef2f2; border-color: #fecaca; }
.receiver-kpi-row .handler-kpi:nth-child(7) { background: #f0fdf4; border-color: #bbf7d0; }
.receiver-kpi-row .handler-kpi:nth-child(8) { background: #fff1f2; border-color: #fecdd3; }
.handler-kpi-val {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}
.handler-kpi-label {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.week-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 8px;
}
.week-label {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  min-width: 200px;
  text-align: center;
}

.week-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.week-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  background: #fff;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
}
.week-stat-label {
  font-size: 11px;
  color: #94a3b8;
}
.week-stat-val {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.week-orders {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.week-order-header, .week-order-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  align-items: center;
}
.week-order-header {
  background: #f8fafc;
  font-weight: 600;
  color: #64748b;
}
.week-order-row {
  border-top: 1px solid #f1f5f9;
  color: #334155;
}
.week-order-row {
  cursor: pointer;
}
.week-order-row:hover {
  background: #eef2ff;
}
.week-order-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.week-empty {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 13px;
}
.kpi-clickable {
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
}
.kpi-clickable:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}
.kpi-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 11px;
  color: #a0aec0;
  margin-top: 6px;
  transition: color 0.15s;
}
.kpi-clickable:hover .kpi-hint {
  color: #6366f1;
}
.kpi-selected {
  box-shadow: 0 0 0 2px #6366f1 !important;
}
.kpi-order-list {
  margin-bottom: 16px;
}
.kpi-order-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}
.handler-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px;
  color: #94a3b8;
  font-size: 13px;
}

/* Handler order list 5-column layout */
.handler-order-5col {
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr !important;
}
.handler-order-6col {
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr !important;
}
.kpi-order-list-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.receiver-tag {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
}
.receiver-summary-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  margin-bottom: 8px;
  background: #fffbeb;
  border: 1px solid #fef3c7;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}
.receiver-summary-name {
  font-weight: 700;
  color: #6366f1;
}
.receiver-summary-item strong {
  font-weight: 700;
}

/* Receiver Detail Section */
.receiver-detail-card {
  margin-bottom: 16px;
}
.sub-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 10px;
  margin-top: 4px;
}
.receiver-handler-table {
  margin-bottom: 16px;
}
.receiver-handler-5col {
  grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr !important;
}
.receiver-profit-detail,
.receiver-settlement-history {
  margin-bottom: 16px;
}
.receiver-profit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.receiver-profit-selected {
  font-size: 12px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 4px 8px;
}
.receiver-profit-table {
  overflow-x: auto;
}
.receiver-profit-12col {
  grid-template-columns: 48px 120px 220px 90px 90px 86px 86px 86px 86px 100px 100px 100px !important;
  min-width: 1220px;
}
.receiver-settlement-7col {
  grid-template-columns: 150px 80px 80px 110px 120px 1fr 80px !important;
}
.receiver-unsettled {
  margin-bottom: 8px;
}
.receiver-unsettled-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.receiver-unsettled-type-filter {
  width: 150px;
}
.receiver-unsettled-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.receiver-unsettled-summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.receiver-unsettled-summary-label {
  font-size: 12px;
  color: #64748b;
}
.receiver-unsettled-summary-value {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}
.receiver-unsettled-6col {
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr !important;
}

@media (max-width: 1200px) {
  .receiver-unsettled-head {
    flex-direction: column;
    align-items: stretch;
  }

  .receiver-unsettled-type-filter {
    width: 100%;
  }

  .receiver-unsettled-summary {
    grid-template-columns: 1fr;
  }

  .receiver-profit-actions {
    justify-content: flex-start;
  }
}

.stats-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #94a3b8;
  font-size: 14px;
}
.loading-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
