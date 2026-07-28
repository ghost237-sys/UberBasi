// Frontend API Client for UberBasi FastAPI Backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface Route {
  id: string;
  name: string;
  code: string;
  description: string;
  default_fare: number;
  stages: Stage[];
  fare_rules: FareRule[];
}

export interface Stage {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  long: number;
  sequence_order: number;
}

export interface FareRule {
  id: string;
  route_id: string;
  min_stage_sequence: number;
  max_stage_sequence: number;
  fare_amount: number;
}

export interface Vehicle {
  id: string;
  registration_plate: string;
  capacity: number;
  owner_id?: string;
  route_id: string;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  route_id: string;
  departure_time: string;
  status: string;
  surge_multiplier: number;
  direction?: string;
  current_stage_sequence?: number;
  eta_minutes?: number;
  distance_km?: number;
  vehicle?: Vehicle;
  confirmed_count?: number;
  paid_count?: number;
  remaining_seats?: number;
}

export interface Ticket {
  id: string;
  trip_id: string;
  boarding_stage_id: string;
  alighting_stage_id: string;
  fare: number;
  payment_method: string;
  status: string;
  code: string;
  qr_code_base64?: string;
  passenger_phone?: string;
  checkout_request_id?: string;
  mpesa_receipt_number?: string;
  created_at: string;
  boarding_stage?: Stage;
  alighting_stage?: Stage;
}

export interface Subscription {
  id: string;
  rider_name: string;
  rider_phone: string;
  route_id: string;
  valid_from: string;
  valid_until: string;
  status: string;
}

export interface OwnerDashboardData {
  is_sacco_wide: boolean;
  scoped_owner_id?: string;
  total_vehicles: number;
  total_capacity: number;
  total_confirmed_boarded: number;
  total_paid_pending: number;
  leakage_gap_pending_tickets: number;
  total_mpesa_revenue: number;
  total_cash_revenue: number;
  gross_revenue: number;
  total_expenses: number;
  net_handover: number;
  vehicles: Array<{
    vehicle_id: string;
    registration_plate: string;
    owner_name: string;
    capacity: number;
    confirmed_boarded: number;
    paid_pending: number;
    occupancy_rate: number;
    mpesa_revenue: number;
    cash_revenue: number;
    gross_revenue: number;
    expenses: number;
    net_handover: number;
  }>;
  fare_rules_readonly: Array<{
    route_name: string;
    default_fare: number;
    rules: Array<{ min_stage: number; max_stage: number; fare_amount: number }>;
  }>;
}

export interface BillingSummary {
  sacco_name: string;
  total_billable_seats: number;
  total_fare_processed: number;
  total_platform_fees_due: number;
  rate_per_booking: number;
  vehicle_breakdown: Array<{
    vehicle_id: string;
    registration_plate: string;
    billable_seats: number;
    platform_fees_due: number;
  }>;
}

export interface UserSession {
  access_token: string;
  role: string;
  username: string;
  user_id: string;
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('uberbasi_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getStoredToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || 'API Request failed');
  }

  return response.json();
}

export const api = {
  login: async (username: string, password: string): Promise<UserSession> => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Login failed');
    }

    const data: UserSession = await response.json();
    if (typeof window !== 'undefined') {
      localStorage.setItem('uberbasi_token', data.access_token);
      localStorage.setItem('uberbasi_user', JSON.stringify(data));
    }
    return data;
  },

  register: async (data: { username: string; phone?: string; password: string; role: string }) => {
    return request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('uberbasi_token');
      localStorage.removeItem('uberbasi_user');
    }
  },

  getCurrentSession: (): UserSession | null => {
    if (typeof window === 'undefined') return null;
    const str = localStorage.getItem('uberbasi_user');
    return str ? JSON.parse(str) : null;
  },

  // Routes & Quotes
  getRoutes: () => request<Route[]>('/routes'),
  quoteFare: (route_id: string, boarding_stage_id: string, alighting_stage_id: string) =>
    request<{
      route_id: string;
      boarding_stage_name: string;
      alighting_stage_name: string;
      direction: string;
      base_fare: number;
      surge_multiplier: number;
      final_fare: number;
    }>('/routes/quote-fare', {
      method: 'POST',
      body: JSON.stringify({ route_id, boarding_stage_id, alighting_stage_id }),
    }),

  // Trips
  getTrips: (route_id?: string, boarding_stage_id?: string) => {
    const params = new URLSearchParams();
    if (route_id) params.append('route_id', route_id);
    if (boarding_stage_id) params.append('boarding_stage_id', boarding_stage_id);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<Trip[]>(`/trips${queryString}`);
  },
  toggleSurge: (trip_id: string, multiplier: number) =>
    request<Trip>(`/trips/${trip_id}/toggle-surge?multiplier=${multiplier}`, { method: 'POST' }),

  // Tickets
  bookTicket: (data: {
    trip_id: string;
    boarding_stage_id: string;
    alighting_stage_id: string;
    passenger_phone: string;
    ticket_count?: number;
    payment_method?: string;
  }) => request<Ticket>('/tickets/book', { method: 'POST', body: JSON.stringify(data) }),

  simulateMpesaCallback: (checkout_request_id: string, status: string = 'SUCCESS') =>
    request<Ticket>('/tickets/simulate-mpesa-callback', {
      method: 'POST',
      body: JSON.stringify({ checkout_request_id, status }),
    }),

  getTicket: (ticket_id: string) => request<Ticket>(`/tickets/${ticket_id}`),
  getTicketsByPhone: (phone: string) => request<Ticket[]>(`/tickets/by-phone/${encodeURIComponent(phone)}`),

  // Conductor
  getMyTrip: () => request<Trip>('/conductor/my-trip'),
  getTripManifest: (trip_id: string) => request<Ticket[]>(`/conductor/trip-manifest/${trip_id}`),
  confirmTicket: (code_or_phone: string, trip_id?: string) =>
    request<{ status: string; is_subscription?: boolean; message: string; ticket?: Ticket }>('/conductor/confirm-ticket', {
      method: 'POST',
      body: JSON.stringify({ code_or_phone, trip_id }),
    }),
  stagePush: (data: {
    trip_id: string;
    boarding_stage_id: string;
    alighting_stage_id: string;
    passenger_phone: string;
  }) => request<Ticket>('/conductor/stage-push', { method: 'POST', body: JSON.stringify(data) }),
  addCashPassenger: (data: {
    trip_id: string;
    boarding_stage_id: string;
    alighting_stage_id: string;
    fare_amount?: number;
  }) => request<Ticket>('/conductor/add-cash-passenger', { method: 'POST', body: JSON.stringify(data) }),
  logExpense: (trip_id: string, category: string, amount: number) =>
    request<{ id: string; category: string; amount: number; logged_at: string }>('/conductor/log-expense', {
      method: 'POST',
      body: JSON.stringify({ trip_id, category, amount }),
    }),

  // Subscriptions
  purchasePass: (data: { rider_name: string; rider_phone: string; route_id: string; days?: number }) =>
    request<Subscription>('/passes/purchase', { method: 'POST', body: JSON.stringify(data) }),
  lookupPass: (phone: string) => request<Subscription>(`/passes/lookup/${phone}`),

  // Owner
  getOwnerDashboard: (owner_id?: string) =>
    request<OwnerDashboardData>(`/owner/dashboard${owner_id ? `?owner_id=${owner_id}` : ''}`),

  // Billing
  getBillingSummary: () => request<BillingSummary>('/billing/summary'),
  generateInvoice: () => request<any>('/billing/generate-invoice', { method: 'POST' }),

  // Admin Fare Rules
  createFareRule: (data: { route_id: string; min_stage_sequence: number; max_stage_sequence: number; fare_amount: number }) =>
    request<FareRule>('/admin/fare-rules', { method: 'POST', body: JSON.stringify(data) }),
  deleteFareRule: (rule_id: string) =>
    request<{ status: string; message: string }>(`/admin/fare-rules/${rule_id}`, { method: 'DELETE' }),
};
