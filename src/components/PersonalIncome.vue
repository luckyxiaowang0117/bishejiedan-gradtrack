<template>
  <section class="personal-income" aria-labelledby="personal-income-heading">
    <h3 id="personal-income-heading">本人收益</h3>
    <p class="income-scope">按建单时间筛选本人接单或本人处理的订单。他人接单、本人处理的订单按客户已收减退款计入收益。</p>

    <dl class="income-summary">
      <div v-for="metric in metrics" :key="metric.key" class="income-metric">
        <dt>{{ metric.label }}</dt>
        <dd :class="{ 'income-negative': totals[metric.key] < 0 }">{{ formatMoney(totals[metric.key]) }}</dd>
      </div>
    </dl>

    <template v-if="orders.length">
      <h4 class="income-list-heading">
        <button
          type="button"
          class="income-list-toggle"
          :aria-expanded="detailsExpanded"
          aria-controls="personal-income-orders"
          @click="detailsExpanded = !detailsExpanded"
        >
          <span>收益订单明细（{{ orders.length }} 单）</span>
          <span class="income-toggle-action">
            {{ detailsExpanded ? '收起' : '展开' }}
            <el-icon aria-hidden="true"><ArrowUp v-if="detailsExpanded" /><ArrowDown v-else /></el-icon>
          </span>
        </button>
      </h4>
      <div id="personal-income-orders" :hidden="!detailsExpanded">
        <el-table
          v-if="detailsExpanded"
          :data="orders"
          :summary-method="tableSummary"
          :default-sort="{ prop: 'createdAt', order: 'descending' }"
          row-key="id"
          size="small"
          max-height="420"
          show-summary
          aria-label="本人收益订单明细"
        >
          <el-table-column label="订单" min-width="160">
            <template #default="{ row }">
              <el-button link type="primary" class="income-order-link" @click="$emit('navigate-order', row.id)">
                {{ row.orderCode ? row.orderCode + ' · ' : '' }}{{ row.title?.trim() || '待补充题目' }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="建单日期" width="105" sortable>
            <template #default="{ row }">{{ row.createdAt?.slice(0, 10) || '—' }}</template>
          </el-table-column>
          <el-table-column prop="receiver" label="接单人" min-width="66" show-overflow-tooltip>
            <template #default="{ row }"><span class="income-person">{{ row.receiver }}</span></template>
          </el-table-column>
          <el-table-column prop="handler" label="处理人" min-width="66" show-overflow-tooltip>
            <template #default="{ row }"><span class="income-person">{{ row.handler }}</span></template>
          </el-table-column>
          <el-table-column
            v-for="column in moneyColumns"
            :key="column.key"
            :prop="column.key"
            :label="column.label"
            :min-width="column.width"
            align="right"
            sortable
          >
            <template #default="{ row }">
              <span :class="{ 'income-negative': row[column.key] < 0 }">{{ formatMoney(row[column.key]) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
    <p v-else class="income-empty">当前统计范围内暂无本人接单或处理的订单</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  orders: { type: Array, required: true },
})
defineEmits(['navigate-order'])

const metrics = [
  { key: 'cashNet', label: '实际收付净额', width: 112 },
  { key: 'projectedProfit', label: '预计订单收益', width: 112 },
  { key: 'customerDue', label: '客户待收' },
  { key: 'handlerDue', label: '处理费待付' },
]
const moneyColumns = [
  { key: 'paidAmount', label: '客户已收', width: 89 },
  { key: 'refundAmount', label: '退款', width: 72 },
  { key: 'handlerPaidAmount', label: '已付处理费', width: 102 },
  ...metrics.slice(0, 2),
]

const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
const formatMoney = value => currency.format(value)
const cents = amount => Math.round(amount * 100)
const sumMoney = (orders, key) => orders.reduce((sum, order) => sum + cents(order[key]), 0) / 100
const totals = computed(() => Object.fromEntries(metrics.map(({ key }) => [key, sumMoney(props.orders, key)])))

const detailsExpanded = ref(false)

function tableSummary({ columns, data }) {
  return columns.map((column, index) => {
    if (index === 0) return `当前列表合计（${data.length} 单）`
    if (moneyColumns.some(({ key }) => key === column.property)) {
      return formatMoney(sumMoney(data, column.property))
    }
    return ''
  })
}
</script>

<style scoped>
.personal-income {
  min-width: 0;
  margin-bottom: 16px;
}
.personal-income h3 {
  margin: 0;
  font-size: 15px;
  color: var(--gt-text-heading);
}
.income-scope {
  margin: 6px 0 14px;
  font-size: 13px;
  line-height: 1.5;
}
.income-scope,
.income-person,
#personal-income-orders :deep(tfoot td:first-child .cell) {
  color: var(--gt-text-heading);
  font-weight: 600;
}
.income-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 18px;
}
.income-metric {
  padding: 11px 14px;
  border: 1px solid var(--gt-border);
  border-radius: 10px;
  background: var(--gt-surface-subtle);
}
.income-metric:first-child {
  border-color: var(--gt-success-border);
  background: var(--gt-success-surface);
}
.income-metric dt {
  font-size: 12px;
  font-weight: 600;
  color: var(--gt-text-main);
}
.income-metric dd {
  margin: 4px 0 0;
  color: var(--gt-text-heading);
  font-size: clamp(15px, 2vw, 22px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.income-negative, .income-metric dd.income-negative {
  color: var(--gt-text-danger);
}
.income-list-heading {
  margin: 0;
  font-size: 14px;
}
.income-list-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--gt-border);
  border-radius: 8px;
  background: var(--gt-surface-subtle);
  color: var(--gt-text-main);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.income-list-toggle:hover {
  background: var(--gt-accent-surface);
}
.income-list-toggle:focus-visible {
  outline: 2px solid var(--gt-text-accent);
  outline-offset: 2px;
}
.income-toggle-action {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--gt-text-accent);
  font-size: 12px;
  white-space: nowrap;
}
#personal-income-orders {
  margin-top: 8px;
}
.income-order-link {
  max-width: 100%;
  height: auto;
  text-align: left;
}
.income-order-link :deep(span) {
  display: block;
  white-space: normal;
  overflow-wrap: anywhere;
}
.income-empty {
  margin: 0;
  padding: 14px;
  color: var(--gt-text-main);
  font-size: 13px;
  text-align: center;
}
@media (max-width: 1050px) {
  .income-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
