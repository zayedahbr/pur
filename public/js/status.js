/* ============================================================
   Mapping des statuts de commande — utilisé sur account/admin
   ============================================================ */

const STATUS_MAP = {
  pending: {
    label: 'En attente de paiement',
    short: 'En attente',
    badge: 'badge-warning',
    description: 'Le paiement n\'a pas encore été finalisé.',
    icon: 'clock'
  },
  paid: {
    label: 'Paiement confirmé',
    short: 'Payée',
    badge: 'badge-info',
    description: 'Votre commande va passer en production.',
    icon: 'check'
  },
  in_production: {
    label: 'En production',
    short: 'En production',
    badge: 'badge-info',
    description: 'Votre PureSpec est en cours d\'impression.',
    icon: 'cog'
  },
  shipped: {
    label: 'Expédiée',
    short: 'Expédiée',
    badge: 'badge-success',
    description: 'Votre commande est en route.',
    icon: 'truck'
  },
  delivered: {
    label: 'Livrée',
    short: 'Livrée',
    badge: 'badge-success',
    description: 'Votre commande vous a été livrée.',
    icon: 'package'
  },
  cancelled: {
    label: 'Annulée',
    short: 'Annulée',
    badge: 'badge-danger',
    description: 'Cette commande a été annulée.',
    icon: 'x'
  }
};

const STATUS_ORDER = ['pending', 'paid', 'in_production', 'shipped', 'delivered'];

function statusInfo(statut) {
  return STATUS_MAP[statut] || {
    label: statut || '—',
    short: statut || '—',
    badge: 'badge-neutral',
    description: '',
    icon: 'circle'
  };
}

function statusBadge(statut) {
  const info = statusInfo(statut);
  return `<span class="badge ${info.badge}"><span class="badge-dot"></span>${info.short}</span>`;
}

window.PureSpecStatus = { STATUS_MAP, STATUS_ORDER, statusInfo, statusBadge };
