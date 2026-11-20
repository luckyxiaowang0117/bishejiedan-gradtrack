<template>
  <div class="stats-wrapper">
    <header class="stats-header">
      <div class="stats-header-left">
        <el-icon :size="20" color="var(--gt-text-violet)"><DataLine /></el-icon>
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
          <el-icon :size="16" color="var(--gt-text-violet)"><Calendar /></el-icon>
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
          <el-icon :size="16" color="var(--gt-text-violet)"><Calendar /></el-icon>
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
          <div class="kpi-icon" style="background: var(--gt-accent-surface); color: var(--gt-text-violet);">
            <el-icon :size="22"><DataBoard /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">{{ data.totalOrders }}</div>
            <div class="kpi-label">总订单数</div>
            <div class="kpi-sub">已完成 {{ data.completedCount }} 单 · 待补题目 {{ data.titleMissingCount || 0 }} 单</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: var(--gt-success-surface); color: var(--gt-text-success);">
            <el-icon :size="22"><Coin /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">¥{{ fmt(data.overall.totalRevenue) }}</div>
            <div class="kpi-label">总收入</div>
            <div class="kpi-sub">已收 ¥{{ fmt(data.overall.totalPaid) }}</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: var(--gt-warning-surface); color: var(--gt-text-warning);">
            <el-icon :size="22"><Money /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value">¥{{ fmt(data.overall.totalDispatch + data.overall.totalRefund) }}</div>
            <div class="kpi-label">总支出</div>
            <div class="kpi-sub">派单 ¥{{ fmt(data.overall.totalDispatch) }} / 退款 ¥{{ fmt(data.overall.totalRefund) }}</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" :style="{ background: netProfit >= 0 ? 'var(--gt-success-surface)' : 'var(--gt-danger-surface)', color: netProfit >= 0 ? 'var(--gt-text-success)' : 'var(--gt-text-danger)' }">
            <el-icon :size="22"><TrendCharts /></el-icon>
          </div>
          <div class="kpi-info">
            <div class="kpi-value" :class="netProfit >= 0 ? 'text-green' : 'text-red'">¥{{ fmt(netProfit) }}</div>
            <div class="kpi-label">净利润</div>
            <div class="kpi-sub" v-if="data.thesisBalance > 0">待收尾款 ¥{{ fmt(data.thesisBalance) }}</div>
          </div>
        </div>
      </div>

      <PersonalIncome
        :key="incomeScopeKey"
        class="chart-card"
        :orders="data.selfIncomeOrders"
        @navigate-order="$emit('navigate-order', $event)"
      />

      <!-- Financial Detail Table -->
      <div class="chart-card table-card">
        <h3 class="chart-title">财务明细</h3>
        <div class="detail-grid">
          <div class="detail-header">
            <span>类型</span><span>全款总额</span><span>派单总额</span><span>退款总额</span><span>净收入</span>
          </div>
          <div v-for="t in typeRows" :key="t.type" class="detail-row">
            <span class="detail-type" :style="{ color: orderTypeMeta[t.type]?.color }">{{ typeLabelMap[t.type] || t.type }}</span>
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
          <p v-if="handlerData.selfHandled" class="self-handler-note">按本人处理的订单统计，实收已扣除退款。</p>
          <div class="handler-kpi-row">
            <div class="handler-kpi" :class="{ 'kpi-selected': kpiFilter === 'all', 'kpi-clickable': handlerData.total.orderCount > 0 }" @click="handlerData.total.orderCount && toggleKpiFilter('all')">
              <div class="handler-kpi-val">{{ handlerData.total.orderCount }}</div>
              <div class="handler-kpi-label">{{ handlerData.selfHandled ? '本人处理订单数' : '总接单量' }}</div>
              <div v-if="handlerData.total.orderCount" class="kpi-hint"><el-icon :size="12"><View /></el-icon>点击查看</div>
            </div>
            <template v-if="handlerData.selfHandled">
              <div class="handler-kpi">
                <div class="handler-kpi-val">¥{{ fmtMoney(handlerData.total.receipts.totalAmount) }}</div>
                <div class="handler-kpi-label">订单总额</div>
              </div>
              <div class="handler-kpi">
                <div class="handler-kpi-val text-green">¥{{ fmtMoney(handlerData.total.receipts.netCollected) }}</div>
                <div class="handler-kpi-label">实收金额</div>
              </div>
              <div class="handler-kpi">
                <div class="handler-kpi-val text-red">¥{{ fmtMoney(handlerData.total.receipts.outstanding) }}</div>
                <div class="handler-kpi-label">待收金额</div>
              </div>
            </template>
            <template v-else>
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
            </template>
          </div>

          <div v-if="handlerData.selfHandled && !handlerData.total.orderCount" class="week-empty">当前统计范围内暂无本人处理的订单</div>

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
            <div v-if="handlerOrderSummary && !handlerData.selfHandled" class="receiver-summary-bar">
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
              <div class="week-order-header" :class="handlerData.selfHandled ? 'self-handler-list-row' : kpiFilter === 'unpaid' ? 'handler-order-6col' : 'handler-order-5col'">
                <template v-if="handlerData.selfHandled">
                  <span>订单名称</span><span>接单人</span><span>类型</span>
                </template>
                <template v-else-if="kpiFilter === 'unpaid'">
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
                :class="handlerData.selfHandled ? 'self-handler-list-row' : kpiFilter === 'unpaid' ? 'handler-order-6col' : 'handler-order-5col'"
                @click="$emit('navigate-order', o.id)"
              >
                <span class="week-order-title">{{ o.title || '待补充题目' }}</span>
                <span class="receiver-tag">{{ o.receiver || '本人' }}</span>
                <span :style="{ color: orderTypeMeta[o.orderType]?.color }">{{ typeLabelMap[o.orderType] || o.orderType }}</span>
                <template v-if="!handlerData.selfHandled && kpiFilter === 'unpaid'">
                  <span>¥{{ fmt(o.dispatchAmount) }}</span>
                  <span class="text-green">¥{{ fmt(o.handlerPaidAmount) }}</span>
                  <span class="text-red">¥{{ fmt((o.dispatchAmount || 0) - (o.handlerPaidAmount || 0)) }}</span>
                </template>
                <template v-else-if="!handlerData.selfHandled">
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
              <span class="week-stat-label">{{ handlerData.selfHandled ? '本周处理' : '本周接单' }}</span>
              <span class="week-stat-val">{{ handlerData.week.orderCount }} 单</span>
            </div>
            <div class="week-stat">
              <span class="week-stat-label">{{ handlerData.selfHandled ? '本周订单总额' : '本周应付' }}</span>
              <span class="week-stat-val">¥{{ handlerData.selfHandled ? fmtMoney(handlerData.week.receipts.totalAmount) : fmt(handlerData.week.totalDispatch) }}</span>
            </div>
            <div class="week-stat">
              <span class="week-stat-label">{{ handlerData.selfHandled ? '本周实收' : '本周已付' }}</span>
              <span class="week-stat-val text-green">¥{{ handlerData.selfHandled ? fmtMoney(handlerData.week.receipts.netCollected) : fmt(handlerData.week.paidAmount) }}</span>
            </div>
            <div class="week-stat">
              <span class="week-stat-label">{{ handlerData.selfHandled ? '本周待收' : '本周未结' }}</span>
              <span class="week-stat-val text-red">¥{{ handlerData.selfHandled ? fmtMoney(handlerData.week.receipts.outstanding) : fmt(handlerData.week.unpaidAmount) }}</span>
            </div>
          </div>

          <!-- Week orders list -->
          <div v-if="handlerData.week.orders.length > 0" class="week-orders" :class="{ 'self-handler-week-orders': handlerData.selfHandled }">
            <div class="week-order-header">
              <span>订单名称</span>
              <template v-if="handlerData.selfHandled">
                <span>接单人</span><span>订单金额</span><span>实收</span><span>待收</span>
              </template>
              <template v-else>
                <span>类型</span><span>派单金额</span><span>状态</span>
              </template>
            </div>
            <div v-for="o in handlerData.week.orders" :key="o.id" class="week-order-row" @click="$emit('navigate-order', o.id)">
              <span class="week-order-title">{{ o.title || '待补充题目' }}</span>
              <template v-if="handlerData.selfHandled">
                <span class="receiver-tag" :title="o.receiver">{{ o.receiver }}</span>
                <span>¥{{ fmtMoney(o.totalAmount) }}</span>
                <span class="text-green">¥{{ fmtMoney(o.netCollected) }}</span>
                <span class="text-red">¥{{ fmtMoney(o.outstanding) }}</span>
              </template>
              <template v-else>
                <span :style="{ color: orderTypeMeta[o.orderType]?.color }">{{ typeLabelMap[o.orderType] || o.orderType }}</span>
                <span>¥{{ fmt(o.dispatchAmount) }}</span>
                <el-tag :type="(o.handlerPaidAmount || 0) >= (o.dispatchAmount || 0) && o.dispatchAmount > 0 ? 'success' : 'warning'" size="small" effect="plain">
                  {{ (o.handlerPaidAmount || 0) >= (o.dispatchAmount || 0) && o.dispatchAmount > 0 ? '已结清' : '已付¥' + fmt(o.handlerPaidAmount || 0) }}
                </el-tag>
              </template>
            </div>
          </div>
          <div v-else class="week-empty">本周暂无订单记录</div>
        </template>

        <div v-else class="handler-placeholder">
          <el-icon :size="28" color="var(--gt-border-strong)"><User /></el-icon>
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
          <div class="handler-kpi-row">
            <div class="handler-kpi">
              <div class="handler-kpi-val">{{ receiverData.total.orderCount }}</div>
              <div class="handler-kpi-label">总接单量</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val">¥{{ fmtMoney(receiverData.total.totalAmount) }}</div>
              <div class="handler-kpi-label">总订单额</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val text-green">¥{{ fmtMoney(receiverData.total.paidAmount) }}</div>
              <div class="handler-kpi-label">客户已收（{{ receiverData.total.paidCount }} 笔已结清）</div>
            </div>
            <div class="handler-kpi">
              <div class="handler-kpi-val text-red">¥{{ fmtMoney(receiverData.total.unpaidAmount) }}</div>
              <div class="handler-kpi-label">客户待收（{{ receiverData.total.unpaidCount }} 笔）</div>
            </div>
          </div>

          <!-- By Handler Breakdown -->
          <div v-if="receiverData.byHandler && receiverData.byHandler.length > 0" class="receiver-handler-table">
            <h4 class="sub-section-title">关联处理人分布</h4>
            <div class="week-orders">
              <div class="week-order-header receiver-handler-5col">
                <span>处理人</span><span>订单数</span><span>派单总额</span><span>已付处理费</span><span>待付处理费</span>
              </div>
              <template v-for="(h, index) in receiverData.byHandler" :key="h.name">
                <button
                  type="button"
                  class="week-order-row receiver-handler-5col receiver-handler-toggle"
                  :aria-expanded="expandedReceiverHandler === h.name"
                  :aria-controls="'receiver-handler-orders-' + index"
                  @click="expandedReceiverHandler = expandedReceiverHandler === h.name ? '' : h.name"
                >
                  <span class="receiver-handler-name">
                    <el-icon aria-hidden="true"><ArrowDown v-if="expandedReceiverHandler === h.name" /><ArrowRight v-else /></el-icon>
                    <span class="week-order-title" :title="h.name">{{ h.name }}</span>
                  </span>
                  <span>{{ h.orderCount }} 单</span>
                  <span>{{ h.name === '本人' ? '—' : '¥' + fmtMoney(h.totalDispatch) }}</span>
                  <span class="text-green">{{ h.name === '本人' ? '—' : '¥' + fmtMoney(h.paidAmount) }}</span>
                  <span class="text-red">{{ h.name === '本人' ? '—' : '¥' + fmtMoney(h.unpaidAmount) }}</span>
                </button>
                <div :id="'receiver-handler-orders-' + index" :hidden="expandedReceiverHandler !== h.name" class="receiver-handler-orders">
                  <template v-if="expandedReceiverHandler === h.name">
                    <h5>{{ h.name }}的订单（{{ expandedReceiverOrders.length }} 单）</h5>
                    <el-table :data="expandedReceiverOrders" row-key="id" size="small" max-height="400" aria-label="处理人订单明细">
                      <el-table-column label="订单" min-width="175">
                        <template #default="{ row }">
                          <el-button link type="primary" class="receiver-order-link" @click="$emit('navigate-order', row.id)">
                            {{ row.orderCode ? row.orderCode + ' · ' : '' }}{{ row.title?.trim() || '待补充题目' }}
                          </el-button>
                        </template>
                      </el-table-column>
                      <el-table-column label="类型" min-width="90">
                        <template #default="{ row }">{{ typeLabelMap[row.orderType || 'thesis'] || row.orderType }}</template>
                      </el-table-column>
                      <el-table-column label="订单金额" min-width="95" align="right">
                        <template #default="{ row }">¥{{ fmtMoney(row.totalAmount) }}</template>
                      </el-table-column>
                      <el-table-column label="客户已收" min-width="95" align="right">
                        <template #default="{ row }">¥{{ fmtMoney(row.paidAmount) }}</template>
                      </el-table-column>
                      <el-table-column v-for="column in receiverDispatchColumns" :key="column.key" :label="column.label" min-width="105" align="right">
                        <template #default="{ row }">{{ h.name === '本人' ? '—' : '¥' + fmtMoney(row[column.key]) }}</template>
                      </el-table-column>
                      <el-table-column label="处理费状态" min-width="105">
                        <template #default="{ row }">{{ receiverDispatchStatus(row) }}</template>
                      </el-table-column>
                    </el-table>
                  </template>
                </div>
              </template>
            </div>
          </div>

          <!-- Unsettled Orders -->
          <div v-if="receiverUnsettledOrders.length > 0" class="receiver-unsettled">
            <div class="receiver-unsettled-head">
              <h4 class="sub-section-title">客户待收订单明细（{{ filteredReceiverUnsettledOrders.length }}）</h4>
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
                <strong class="receiver-unsettled-summary-value">¥{{ fmtMoney(receiverUnsettledSummary.totalAmount) }}</strong>
              </div>
              <div class="receiver-unsettled-summary-card">
                <span class="receiver-unsettled-summary-label">客户已收</span>
                <strong class="receiver-unsettled-summary-value text-green">¥{{ fmtMoney(receiverUnsettledSummary.paidAmount) }}</strong>
              </div>
              <div class="receiver-unsettled-summary-card">
                <span class="receiver-unsettled-summary-label">客户待收</span>
                <strong class="receiver-unsettled-summary-value text-red">¥{{ fmtMoney(receiverUnsettledSummary.unpaidAmount) }}</strong>
              </div>
            </div>

            <div class="week-orders">
              <div class="week-order-header receiver-unsettled-6col">
                <span>订单名称</span><span>类型</span><span>处理人</span><span>总金额</span><span>客户已收</span><span>客户待收</span>
              </div>
              <div v-for="o in filteredReceiverUnsettledOrders" :key="o.id" class="week-order-row receiver-unsettled-6col" @click="$emit('navigate-order', o.id)">
                <span class="week-order-title">{{ o.title }}</span>
                <span :style="{ color: orderTypeMeta[o.orderType]?.color }">{{ typeLabelMap[o.orderType] || o.orderType }}</span>
                <span>{{ o.handler || '本人' }}</span>
                <span>¥{{ fmtMoney(o.totalAmount) }}</span>
                <span class="text-green">¥{{ fmtMoney(o.paidAmount) }}</span>
                <span class="text-red">¥{{ fmtMoney(o.customerDue) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="week-empty">{{ receiverData.total.orderCount ? '该接单人名下无客户待收订单' : '当前统计范围内该接单人暂无订单' }}</div>
        </template>

        <div v-else class="handler-placeholder">
          <el-icon :size="28" color="var(--gt-border-strong)"><User /></el-icon>
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
import { orderTypeMeta } from '../orderTypeMeta.js'
import PersonalIncome from './PersonalIncome.vue'

defineEmits(['close', 'navigate-order'])
const api = window.electronAPI
const currentUser = inject('currentUser')
const data = ref(null)
const incomeScopeKey = ref(0)

const typeLabelMap = Object.fromEntries(Object.entries(orderTypeMeta).map(([key, type]) => [key, type.label]))
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
  if (statsGradYear.value === val) return
  statsGradYear.value = val
  loadStats()
}

let summaryRequest = 0

async function loadStats() {
  const scope = getStatsParams()
  if (!scope.userId) return
  const request = ++summaryRequest
  ++handlerRequest
  ++receiverRequest
  handlerData.value = null
  receiverData.value = null
  expandedReceiverHandler.value = ''
  loadingWeek.value = false
  const summary = await api.getStats(scope)
  if (request !== summaryRequest) return
  data.value = summary
  incomeScopeKey.value = request
  if (!summary.handlerOptions.includes(selectedHandler.value)) selectedHandler.value = ''
  if (!summary.receiverOptions.includes(selectedReceiver.value)) selectedReceiver.value = ''
  await Promise.all([loadHandlerDetail(), loadReceiverDetail()])
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

watch(timeMode, loadStats)

const selectedHandler = ref('')
const handlerData = ref(null)
const weekOffset = ref(0)
const loadingWeek = ref(false)

const handlerList = computed(() => data.value?.handlerOptions || [])
let handlerRequest = 0

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

async function fetchHandlerDetail(offset) {
  const request = ++handlerRequest
  const scope = getStatsParams()
  if (!selectedHandler.value || !scope.userId) return
  try {
    const result = await api.getHandlerDetail(scope, selectedHandler.value, offset)
    if (request !== handlerRequest) return
    handlerData.value = result
    weekOffset.value = offset
  } finally {
    if (request === handlerRequest) loadingWeek.value = false
  }
}

function loadHandlerDetail() {
  handlerData.value = null
  loadingWeek.value = false
  weekOffset.value = 0
  kpiFilter.value = ''
  selectedReceiverInHandler.value = ''
  handlerOrderTypeFilter.value = 'all'
  return fetchHandlerDetail(0)
}

function changeWeek(dir) {
  loadingWeek.value = true
  return fetchHandlerDetail(Math.max(0, weekOffset.value + dir))
}

// --- Receiver Detail ---
const selectedReceiver = ref('')
const receiverData = ref(null)
const receiverUnsettledTypeFilter = ref('all')
const expandedReceiverHandler = ref('')

const receiverDispatchColumns = [
  { key: 'dispatchAmount', label: '派单金额' },
  { key: 'handlerPaidAmount', label: '已付处理费' },
  { key: 'handlerDue', label: '待付处理费' },
]

const expandedReceiverOrders = computed(() =>
  (receiverData.value?.allOrders || []).filter(order => order.handler === expandedReceiverHandler.value)
)

function receiverDispatchStatus(order) {
  if (order.dispatchAmount <= 0) return '无派单费用'
  if (order.handlerDue === 0) return '已结清'
  return order.handlerPaidAmount > 0 ? '部分支付' : '未支付'
}

const receiverList = computed(() => data.value?.receiverOptions || [])
let receiverRequest = 0

const receiverUnsettledOrders = computed(() => {
  if (!receiverData.value) return []
  return (receiverData.value.allOrders || []).filter(o => o.totalAmount > 0 && o.customerDue > 0)
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
    summary.unpaidAmount += order.customerDue
    return summary
  }, { totalAmount: 0, paidAmount: 0, unpaidAmount: 0 })
})

async function loadReceiverDetail() {
  const request = ++receiverRequest
  const scope = getStatsParams()
  receiverData.value = null
  expandedReceiverHandler.value = ''
  receiverUnsettledTypeFilter.value = 'all'
  if (!selectedReceiver.value || !scope.userId) return
  const result = await api.getReceiverDetail(scope, selectedReceiver.value)
  if (request === receiverRequest) receiverData.value = result
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
const moneyFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
function fmtMoney(amount) { return moneyFormat.format(amount ?? 0) }

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
  background: var(--gt-surface);
  border-bottom: 1px solid var(--gt-border);
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
  color: var(--gt-text-body);
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
  background: var(--gt-surface);
  border: 1px solid var(--gt-border);
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
  color: light-dark(#334155, var(--gt-text-body));
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
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--gt-border-strong);
  background: var(--gt-surface);
  color: var(--gt-text-main);
  border-radius: 16px;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.stats-grad-btn:hover {
  color: light-dark(#4f46e5, #c7d2fe);
  border-color: var(--gt-accent-border);
  background: var(--gt-accent-surface);
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
  color: var(--gt-text-violet);
  font-weight: 600;
  background: var(--gt-accent-surface);
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
  background: var(--gt-surface);
  border: 1px solid var(--gt-border-strong);
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
  font-weight: 800;
  color: var(--gt-text-heading);
  line-height: 1.2;
}
.kpi-label {
  font-size: 13px;
  color: var(--gt-text-main);
  font-weight: 700;
  margin-top: 2px;
}
.kpi-sub {
  font-size: 12px;
  color: var(--gt-text-main);
  font-weight: 600;
  margin-top: 2px;
}

.chart-card {
  background: var(--gt-surface);
  border: 1px solid var(--gt-border);
  border-radius: 14px;
  padding: var(--gt-card-pad);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.chart-title {
  font-size: var(--gt-text-sm);
  font-weight: 600;
  color: light-dark(#334155, var(--gt-text-body));
  margin-bottom: 12px;
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
  background: var(--gt-surface-subtle);
  border-radius: 8px;
  font-weight: 700;
  color: var(--gt-text-main);
}
.detail-row {
  border-bottom: 1px solid var(--gt-border);
  color: var(--gt-text-main);
  font-weight: 500;
}
.detail-type {
  font-weight: 700;
}
.text-green { color: var(--gt-text-success); }
.text-red { color: var(--gt-text-danger); }

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
.self-handler-note {
  margin: 0 0 10px;
  color: var(--gt-text-body);
  font-size: 13px;
  font-weight: 600;
}
.week-orders .self-handler-list-row {
  grid-template-columns: 2fr 1fr 1fr;
}
.self-handler-week-orders .week-order-header,
.self-handler-week-orders .week-order-row {
  grid-template-columns: minmax(0, 2fr) repeat(4, minmax(0, 1fr));
}
.self-handler-week-orders .week-order-row > :not(.week-order-title) {
  overflow-wrap: anywhere;
}
.handler-kpi {
  border: 1px solid var(--gt-border-strong);
  border-radius: 10px;
  padding: 14px 16px;
  text-align: center;
}
.handler-kpi:nth-child(1) { background: var(--gt-accent-surface); border-color: var(--gt-accent-border); }
.handler-kpi:nth-child(2) { background: light-dark(#f0f9ff, var(--gt-surface-muted)); border-color: light-dark(#bae6fd, var(--gt-border)); }
.handler-kpi:nth-child(3) { background: light-dark(var(--gt-success-surface), var(--gt-surface-muted)); border-color: light-dark(var(--gt-success-border), var(--gt-border)); }
.handler-kpi:nth-child(4) { background: light-dark(#fff1f2, var(--gt-surface-muted)); border-color: light-dark(var(--gt-danger-border), var(--gt-border)); }
.handler-kpi-val {
  font-size: 20px;
  font-weight: 800;
  color: var(--gt-text-heading);
  line-height: 1.2;
}
.handler-kpi-label {
  font-size: 12px;
  color: var(--gt-text-main);
  font-weight: 700;
  margin-top: 4px;
}

.week-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 10px;
  background: var(--gt-surface-subtle);
  border-radius: 8px;
}
.week-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--gt-text-heading);
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
  background: var(--gt-surface);
  border: 1px solid var(--gt-border-strong);
  border-radius: 8px;
}
.week-stat-label {
  font-size: 12px;
  color: var(--gt-text-main);
  font-weight: 700;
}
.week-stat-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--gt-text-heading);
}

.week-orders {
  border: 1px solid var(--gt-border-strong);
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
  background: var(--gt-surface-subtle);
  font-weight: 700;
  color: var(--gt-text-main);
}
.week-order-row {
  border-top: 1px solid var(--gt-border-strong);
  color: var(--gt-text-main);
}
.week-order-row {
  cursor: pointer;
}
.week-order-row:hover {
  background: var(--gt-accent-surface);
}
.week-order-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.week-empty {
  text-align: center;
  padding: 24px;
  color: var(--gt-text-main);
  font-weight: 600;
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
  color: var(--gt-text-muted);
  margin-top: 6px;
  transition: color 0.15s;
}
.kpi-clickable:hover .kpi-hint {
  color: var(--gt-text-accent);
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
  color: light-dark(#334155, var(--gt-text-body));
  margin-bottom: 8px;
}
.handler-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px;
  color: var(--gt-text-main);
  font-weight: 600;
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
  color: var(--gt-text-violet);
  font-weight: 600;
}
.receiver-summary-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  margin-bottom: 8px;
  background: var(--gt-warning-surface);
  border: 1px solid var(--gt-warning-border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--gt-text-warning);
}
.receiver-summary-name {
  font-weight: 700;
  color: var(--gt-text-violet);
}
.receiver-summary-item strong {
  font-weight: 700;
}

/* Receiver Detail Section */
.receiver-detail-card {
  margin-bottom: 16px;
}
.sub-section-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--gt-text-main);
  margin-bottom: 10px;
  margin-top: 4px;
}
.receiver-handler-table {
  margin-bottom: 16px;
}
.receiver-handler-5col {
  grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr !important;
}
.receiver-handler-toggle {
  width: 100%;
  border: 0;
  border-top: 1px solid var(--gt-border-strong);
  background: transparent;
  font-family: inherit;
  text-align: left;
}
.receiver-handler-toggle[aria-expanded="true"] {
  background: var(--gt-accent-surface);
}
.receiver-handler-toggle:focus-visible {
  outline: 2px solid var(--gt-text-accent);
  outline-offset: -2px;
}
.receiver-handler-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.receiver-handler-name .el-icon {
  flex-shrink: 0;
}
.receiver-handler-orders {
  padding: 12px 16px 16px;
  background: var(--gt-surface-subtle);
}
.receiver-handler-orders h5 {
  margin: 0 0 8px;
  color: var(--gt-text-main);
  font-size: 13px;
}
.receiver-order-link {
  max-width: 100%;
  height: auto;
  text-align: left;
}
.receiver-order-link :deep(span) {
  display: block;
  overflow-wrap: anywhere;
  white-space: normal;
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
  border: 1px solid var(--gt-border-strong);
  border-radius: 10px;
  background: var(--gt-surface-subtle);
}
.receiver-unsettled-summary-label {
  font-size: 12px;
  color: var(--gt-text-main);
  font-weight: 700;
}
.receiver-unsettled-summary-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--gt-text-heading);
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
}

.stats-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--gt-text-main);
  font-weight: 600;
  font-size: 14px;
}
.loading-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
