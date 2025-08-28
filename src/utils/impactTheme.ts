/**
 * Helper function to get dynamic theme colors based on count value
 * @param count - The number of issues/elements
 * @returns Object with Tailwind CSS classes for different theme elements
 */
export const getImpactTheme = (count: number) => {
  if (count === 0) {
    return {
      type: 'good' as const,
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-800',
      icon: 'text-green-600',
      badge: 'bg-green-100 text-green-800',
      severity: 'OK'
    };
  }
  
  if (count >= 1 && count <= 4) {
    return {
      type: 'warning' as const,
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
      icon: 'text-yellow-600',
      badge: 'bg-yellow-100 text-yellow-800',
      severity: 'Bassa'
    };
  }
  
  if (count >= 5 && count <= 9) {
    return {
      type: 'high' as const,
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      text: 'text-orange-800',
      icon: 'text-orange-600',
      badge: 'bg-orange-100 text-orange-800',
      severity: 'Media'
    };
  }
  
  // count >= 10
  return {
    type: 'critical' as const,
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-800',
    severity: 'Critica'
  };
};

export type ImpactTheme = ReturnType<typeof getImpactTheme>;
