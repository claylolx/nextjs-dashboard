import postgres from 'postgres';
import {
  LatestInvoice,
  LatestInvoiceRaw,
  Revenue,
  RevenueRaw,
} from './definitions';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// Revenue Chart
export async function fetchRevenue(): Promise<Revenue[]> {
  const data = await sql<RevenueRaw[]>`
    SELECT
      EXTRACT(MONTH FROM date) AS month,
      SUM(amount) AS revenue
    FROM invoices
    WHERE status = 'paid'
    GROUP BY month
    ORDER BY month`;

  return data.map((item) => ({
    month: new Date(0, item.month - 1).toLocaleString('en-US', {
      month: 'short',
    }),
    revenue: Number(item.revenue),
  }));
}

// Últimas facturas (5)
export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  const data = await sql<LatestInvoiceRaw[]>`
    SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    ORDER BY invoices.date DESC
    LIMIT 5`;

  return data.map((invoice) => ({
    id: invoice.id,
    name: invoice.name,
    email: invoice.email,
    image_url: invoice.image_url,
    amount: invoice.amount, // tipo number, tal como espera `LatestInvoice`
  }));
}

// Métricas generales (tarjetas)
export async function fetchCardData() {
  const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
  const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
  const invoiceStatusPromise = sql`
    SELECT
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
    FROM invoices`;

  const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
    invoiceCountPromise,
    customerCountPromise,
    invoiceStatusPromise,
  ]);

  return {
    numberOfInvoices: Number(invoiceCount[0].count),
    numberOfCustomers: Number(customerCount[0].count),
    totalPaidInvoices: Number(invoiceStatus[0].paid),
    totalPendingInvoices: Number(invoiceStatus[0].pending),
  };
}
