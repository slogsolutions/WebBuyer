import React from 'react';
import { 
  UserCheck,
  BarChart2,
  HandCoins
} from 'lucide-react';
import { Booking, Provider } from '../../types';

interface DashboardProps {
  provider: Provider;
  bookings: Booking[];
}

export function Dashboard({ provider, bookings }: DashboardProps) {
  
}
