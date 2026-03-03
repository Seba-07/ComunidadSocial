/**
 * MemberDirectorio - Read-only view of the organization's directorio for MIEMBRO role.
 * Uses the same dynamic rendering as OrgDirectorio (no hardcoded positions).
 */
import OrgDirectorio from '../OrganizationDashboard/OrgDirectorio';

export default function MemberDirectorio({ org }) {
  return <OrgDirectorio org={org} />;
}
