import type { CollectionConfig } from 'payload';
import { isAdmin, isLoggedIn } from '../access';

/**
 * Every website form submission, stored here as well as emailed. If SMTP2GO
 * has an outage or a mailbox filters one, the lead is still in the dashboard.
 * Created by the form API routes (lib/relay.ts), never from the dashboard.
 */
export const Enquiries: CollectionConfig = {
  slug: 'enquiries',
  labels: { singular: 'Enquiry', plural: 'Enquiries' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'form', 'email', 'phone', 'emailStatus', 'followedUp', 'createdAt'],
    group: 'Enquiries',
    description: 'Every form sent from the website: Contact us, Online doctor referral, Patient information form and Feedback. Each one is also emailed to the practice.',
  },
  access: { read: isLoggedIn, create: () => false, update: isLoggedIn, delete: isAdmin },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'form',
      type: 'select',
      options: [
        { label: 'Contact us', value: 'contact' },
        { label: 'Online doctor referral', value: 'referral' },
        { label: 'Patient information form', value: 'patient-form' },
        { label: 'Feedback', value: 'feedback' },
      ],
      required: true,
      admin: { readOnly: true },
    },
    { name: 'name', type: 'text', label: 'Name (patient for referrals)', admin: { readOnly: true } },
    { name: 'email', type: 'email', admin: { readOnly: true } },
    { name: 'phone', type: 'text', admin: { readOnly: true } },
    { name: 'message', type: 'textarea', admin: { readOnly: true } },
    { name: 'source', type: 'text', admin: { readOnly: true } },
    {
      name: 'emailStatus',
      type: 'select',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
        { label: 'Not configured', value: 'skipped' },
      ],
      admin: { readOnly: true, description: 'Whether the notification email went out.' },
    },
    { name: 'emailError', type: 'text', admin: { readOnly: true, condition: (data) => data?.emailStatus === 'failed' } },
    { name: 'followedUp', type: 'checkbox', label: 'Followed up', defaultValue: false },
    { name: 'notes', type: 'textarea', label: 'Notes' },
    { name: 'raw', type: 'json', label: 'Submitted fields', admin: { readOnly: true } },
  ],
};
