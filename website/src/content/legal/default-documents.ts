/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { LOCALIZED_DEFAULT_LEGAL_DOCUMENTS } from './localized-default-documents'
import { ES_DEFAULT_LEGAL_DOCUMENTS } from './localized-default-documents-es'
import { PT_DEFAULT_LEGAL_DOCUMENTS } from './localized-default-documents-pt'

export const DEFAULT_TERMS_OF_SERVICE = `# flatkey.ai User Agreement

Last Updated: June 4, 2026

This User Agreement ("Agreement") applies to the flatkey.ai services provided by VOC AI INC ("VOC AI," "we," "us," or "our") through flatkey.ai, the dashboard, APIs, checkout pages, documentation, and support channels (the "Services"). By registering an account, creating an organization, adding prepaid account balance, generating or using an API key, calling model APIs, accessing the dashboard, or otherwise using the Services, you agree to this Agreement, our Privacy Policy, Refund Policy, documentation, pricing pages, and any applicable supplemental rules.

Operating entity: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States. Contact: support@flatkey.ai.

## 1. Service Overview

flatkey.ai is an AI API access, model routing, usage metering, dashboard, and prepaid account balance service. Users may access different AI model capabilities through a unified API and dashboard, manage API keys, team permissions, model selection, request records, balances, credits, billing, and support matters.

flatkey.ai is not the model itself. We do not guarantee that any particular model, API, price, context window, rate limit, regional availability, output behavior, data processing rule, or third-party policy will remain available or unchanged. We may add, remove, restrict, or modify models, features, prices, and usage rules based on product needs, cost changes, security requirements, compliance obligations, model provider requirements, or changes to third-party services.

## 2. Eligibility, Accounts, and Organizations

You must be at least 13 years old. If you are under 18, you must have permission from your parent or legal guardian. If you use the Services on behalf of a company, organization, or other entity, you represent that you have authority to accept this Agreement on behalf of that entity.

You must provide truthful, accurate, complete, and current account, business, billing, tax, and contact information. You are responsible for administrators, members, applications, API keys, access credentials, requests, integrations, payment methods, and balance usage under your account.

Organization administrators may invite team members and configure permissions, budgets, models, logs, keys, and security settings. Administrator configurations may affect organization members and end users of your application. You must ensure that your team members and end users comply with this Agreement, our documentation, and applicable model provider terms.

If you believe that your account, API key, access credential, payment method, or dashboard access has been used without authorization, you must contact us promptly and take appropriate steps to revoke, rotate, disable, or restrict access.

## 3. Prepaid Balance, Fees, and Digital Delivery

The Services may require you to purchase prepaid account balance or service credits before calling APIs or using certain features. Before purchase, you will have an opportunity to review the order amount, currency, taxes, fees, payment method, and pricing rules shown on the applicable page.

Account balance and service credits may be used only for eligible flatkey.ai Services. They are not cash, deposits, electronic money, gift cards, payment instruments, withdrawable accounts, or financial products. Unless we expressly agree in writing or applicable law requires otherwise, account balance and service credits may not be withdrawn, redeemed for cash, assigned, used as collateral, invested, or used outside the Services.

After successful payment or order approval, purchased balance or credits are usually delivered electronically to your account and may be used immediately for API requests, model calls, or other paid features. When you make a request, the system deducts balance according to the then-current model price, input usage, output usage, cache hits, requests, files, images, taxes, fees, currency conversion, and any other billing rules shown on the relevant page or checkout flow.

The expiration period for balance or credits is determined by the purchase page, order description, dashboard display, or written confirmation from us. We may restrict, freeze, cancel, or handle under the Refund Policy any balance or credits associated with long-inactive accounts, suspended accounts, closed accounts, fraudulent activity, or policy violations.

## 4. Payments, Taxes, and Invoices

You authorize VOC AI and our payment service providers to charge your selected payment method for order amounts, taxes, fees, and other applicable charges. Payments may be processed by Paddle, Stripe, banks, card networks, wallets, local payment method providers, anti-fraud providers, tax providers, invoice providers, or other necessary service providers.

Depending on the checkout method, the party responsible for collection, invoicing, tax calculation, refund execution, and dispute handling may vary. If Paddle processes an order as Merchant of Record or seller, Paddle may be responsible for payment collection, taxes, invoices, receipts, refunds, and payment dispute workflows. If Stripe or another provider acts only as a payment processor, VOC AI may remain the seller, and the processor may handle payment-related activities on our behalf.

You must provide accurate billing address, company name, tax ID, VAT/GST information, email address, and invoice information. You are responsible for taxes, invoice issues, receipt issues, payment failures, refund delays, compliance reviews, or additional costs caused by inaccurate, incomplete, or outdated information.

## 5. Model Provider Terms and Restrictions

The Services may allow you, your team members, your applications, or your end users to access models, APIs, tools, or features provided by third-party model providers or technical service providers. You understand and agree that use of any model or third-party service may also be subject to that model's or third-party service's terms, policies, regional restrictions, safety rules, data processing rules, and use limitations.

You are responsible for confirming, before using a particular model, that the model and its rules are suitable for your use case, including commercial use, customer-facing use, sensitive data, regulated industries, high-risk decisions, regional access, minors, content safety, and publication of outputs. You must also ensure that your team members and end users use relevant models in accordance with this Agreement, our documentation, and applicable third-party rules.

Certain models or features may not permit access by certain regions, industries, entities, purposes, or request types. You may not use VPNs, proxies, multiple accounts, false information, technical workarounds, or other methods to bypass model, regional, identity, security, or compliance restrictions. We may suspend, restrict, close, or remove your access to relevant models, accounts, API keys, balance, or features if we receive a third-party request, detect risk, or reasonably believe that rules have been violated.

We do not modify, waive, or replace third-party model provider terms. Model providers may change their terms, pricing, features, availability, data processing methods, or access restrictions at any time. Your continued use of a model means you accept the then-current applicable rules.

## 6. Configuration Responsibility

You are responsible for selecting models, configuring accounts, setting team permissions, managing API keys, configuring budgets and rate limits, controlling request sources, reviewing inputs and outputs, and determining whether the Services are suitable for your business scenario.

If you integrate flatkey.ai into your own product or service, you must retain control over your application, end-user access, account permissions, API keys, balance, credits, request sources, logs, abuse handling, and customer support. You may not allow end users to directly obtain, control, resell, split, bulk use, or bypass your application to use flatkey.ai accounts, API keys, balance, or credits.

You are responsible for your team members, applications, integrations, end users, automated scripts, permission settings, and key management. Usage, fees, disputes, or losses caused by your configuration, key leakage, end-user conduct, permission settings, script errors, or internal management issues are your responsibility unless directly caused by our verifiable system error.

## 7. User Content and AI Output

Prompts, text, files, images, code, data, configurations, requests, and other content you submit to the Services are "Inputs." Model responses, generated content, or other results returned by the Services are "Outputs." Inputs and Outputs are collectively "User Content."

You retain the rights you lawfully hold in your Inputs. To provide, route, meter, troubleshoot, support, secure, audit, review refunds for, and improve the Services, you grant us a non-exclusive, worldwide, royalty-free license to process, transmit, store, copy, display, and use User Content and related metadata as necessary.

You represent that you have all rights, permissions, and consents required to submit, process, and transmit Inputs. You may not submit content that violates intellectual property rights, privacy rights, confidentiality obligations, contractual obligations, or applicable law.

AI Outputs may be inaccurate, incomplete, outdated, repetitive, biased, unsafe, unsuitable for a particular purpose, or similar to third-party content. You must independently review and verify Outputs before relying on them, publishing them, using them commercially, deploying them in production, or using them for legal, medical, financial, employment, credit, safety, compliance, or other important decisions. We do not guarantee the accuracy, uniqueness, suitability, availability, or non-infringement of any Output.

Unless the dashboard, documentation, or order description expressly provides a relevant feature, we do not promise to store full Input or Output history. For troubleshooting, security, metering, refund, dispute, or compliance purposes, we may retain request metadata, error records, usage records, and necessary logs.

## 8. No Resale, Relay, or Competitive Use

flatkey.ai accounts, API keys, account balance, service credits, model access capability, and dashboard capability are for use by you and your authorized team in your own business or application. Unless we enter into a separate written agreement, you may not provide flatkey.ai to third parties as a standalone API, balance, credit, subaccount, top-up service, relay service, rebranded service, aggregation service, or similar service, whether by sale, transfer, distribution, rental, sharing, or other indirect arrangement.

You may not access or use the Services for the purpose of reselling API access, building a competing service, bypassing third-party model rules, hiding the true end user, avoiding prices or limits, bypassing regional restrictions, bypassing security review, or bypassing payment review.

Unauthorized resale, relay, account sharing, hiding the true user, bulk account creation, abnormal concentrated calling, limit circumvention, or risk-control evasion is a material breach. We may suspend or terminate related accounts, API keys, balance, credits, and orders, and may deny or limit related refunds, balance restoration, or credit adjustments.

## 9. Prohibited Conduct

You may not:

- use the Services for illegal, fraudulent, infringing, harassing, spam, malware, phishing, system attack, regulatory evasion, privacy invasion, sensitive data scraping, sanctions evasion, export control violation, or other harmful activity;
- create false identities, impersonate others, misrepresent affiliations, or use multiple accounts to avoid limits, risk controls, pricing, refunds, or compliance review;
- bypass or interfere with account limits, regional limits, billing rules, credit limits, rate limits, safety mechanisms, anti-abuse rules, third-party service restrictions, or payment review processes;
- reverse engineer, scan, attack, stress test, disrupt, crawl, copy, scrape, or access without authorization the Services, APIs, systems, data, or other users' accounts;
- conduct adversarial testing, prompt injection, jailbreak testing, safety bypass testing, stress testing, or other testing that may impair models, the Services, third-party rules, or user interests without our written approval;
- submit or distribute infringing, illegal, malicious, fraudulent, misleading, harassing, sexual, violent, hateful, privacy-invasive, restricted, or third-party-policy-violating content;
- assist, encourage, or allow any third party to do any of the above.

## 10. Metering, Delivery, and Review Records

We maintain order, payment, delivery, balance, credit, request, deduction, error, refund, chargeback, dispute, and security records to verify whether delivery was completed, whether usage occurred, whether balance was correctly deducted, whether a refund request is valid, and whether an account shows abnormal use.

We use reasonable efforts to keep metering and billing records accurate, but complex systems may experience delays, errors, duplicate records, or display differences. If a verifiable system error occurs, we may address it through balance restoration, credit correction, billing adjustment, or refund. User screenshots, third-party records, or local logs may be considered supporting materials, but final review will consider our system records, payment service provider records, and necessary third-party service records.

To protect service stability and other users, we may monitor abnormal requests, abnormal deductions, abnormal logins, abnormal payments, bulk calls, key leakage, malicious requests, chargeback abuse, and usage patterns that violate this Agreement, and we may temporarily restrict related features during an investigation.

We may conduct manual or automated review of high-risk orders, large top-ups, abnormal top-up frequency, inconsistent billing information, abnormal login regions, abnormal request sources, short-period high concurrency, or payment service provider alerts. During review, delivery, balance use, refunds, invoices, or account features may be delayed or restricted. After review, we will restore or handle relevant matters according to applicable records.

## 11. Refunds

Refunds, balance restoration, credit corrections, and support adjustments are handled under our flatkey.ai Refund Policy. In general, delivered and used credits, consumed balance, completed requests, and successfully provided digital services are not refundable.

Duplicate charges, non-delivery, verifiable system errors, unused balance, tax or invoice errors, payment disputes, mandatory consumer rights, or payment service provider requirements will be reviewed based on order records, delivery records, usage records, payment status, and applicable rules.

## 12. Third-Party Services

The Services may rely on third-party models, APIs, platforms, cloud services, payment services, tax services, invoice services, hosting, databases, email, analytics, security, and support tools. Third parties provide services and process data under their own terms, policies, and technical rules.

Third-party services may be suspended, rate-limited, rejected, discontinued, repriced, modified, restricted by region, or subject to changed data processing methods. We will use reasonable efforts to maintain the Services, but we do not guarantee continuous availability of any third-party service and are not responsible beyond this Agreement for third-party failures, policy changes, network issues, regional restrictions, model behavior, output quality, or third-party cost changes.

## 13. Suspension, Termination, and Service Changes

If we believe that you have violated this Agreement or third-party policies, used the Services unlawfully, engaged in fraud, created sanctions risk, caused payment risk, abused chargebacks, created security risk, provided the Services to others without authorization, generated abnormal usage, or harmed us or third parties, we may suspend or terminate accounts, orders, API keys, balance, credits, team permissions, or service access.

To the fullest extent permitted by applicable law, balance or credits associated with fraud, abuse, policy violations, sanctions risk, illegal use, chargeback abuse, unauthorized provision to others, or serious security incidents may be restricted, frozen, canceled, refused delivery, or not refunded.

You may stop using the Services. Account closure does not affect payment obligations, usage responsibility, dispute handling, compliance review, indemnity obligations, or provisions of this Agreement that by their nature should continue to apply.

We may modify, suspend, or discontinue part or all of the Services, models, features, prices, documentation, or access methods. Unless applicable law or the Refund Policy requires otherwise, we are not responsible for refunds, damages, or compensation due to third-party model changes, feature discontinuation, price changes, regional restrictions, rate limits, or service changes.

## 14. Intellectual Property, Feedback, and Confidentiality

The website, dashboard, software, APIs, documentation, brands, trademarks, designs, order systems, billing systems, risk-control systems, and related technology are owned by VOC AI or its licensors. Except for the limited right to use the Services under this Agreement, we do not transfer any intellectual property rights to you.

If you provide suggestions, feedback, issue reports, or improvement ideas to us, you grant us the right to use, copy, modify, publish, and commercialize that feedback without payment to you.

If either party discloses information that is marked confidential or should reasonably be understood as confidential by its nature, the receiving party must protect it with reasonable care and use it only as necessary to perform this Agreement or provide the Services. Disclosure required by law, regulators, courts, payment service providers, tax authorities, or dispute handling bodies is permitted.

## 15. Disclaimers and Limitation of Liability

The Services are provided "as is" and "as available." To the fullest extent permitted by applicable law, we do not guarantee that the Services will be uninterrupted, error-free, vulnerability-free, loss-free, or suitable for your business needs, or that any model, API, price, credit, output, latency, rate limit, regional availability, payment method, or third-party service will remain available.

To the fullest extent permitted by applicable law, VOC AI is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost revenue, lost goodwill, data loss, business interruption, substitute procurement costs, AI Outputs, third-party service conduct, third-party payment conduct, or third-party platform conduct.

To the fullest extent permitted by applicable law, VOC AI's total liability arising from the Services, orders, balance, delivery, usage, refunds, or this Agreement will not exceed the greater of the amount you actually paid for the relevant Services in the 3 months before the claim and not refunded, or USD 100. This limitation does not apply to liability that cannot be limited by law.

## 16. Indemnity

To the fullest extent permitted by applicable law, you will indemnify and hold harmless VOC AI, its affiliates, service providers, and third-party service providers from claims, losses, liabilities, penalties, costs, and expenses arising from your account activity, User Content, API key use, integrations, unlawful use, violation of this Agreement, violation of third-party policies, unauthorized provision to others, infringement, privacy violations, tax information errors, payment disputes, chargebacks, or team member conduct.

## 17. Governing Law and Dispute Resolution

Without limiting any non-waivable consumer protection, data protection, or mandatory local law rights, this Agreement is governed by the laws of the State of California, United States, without regard to conflict of laws rules.

For any dispute relating to this Agreement or the Services, the parties will first attempt in good faith to resolve the dispute by contacting support@flatkey.ai. If the dispute is not resolved, except for small claims matters or matters for which arbitration is prohibited by law, the parties agree to submit the dispute to arbitration in California before a competent arbitration provider under its rules. You and VOC AI each waive the right to resolve disputes through class actions, representative actions, or jury trials, unless applicable law does not permit such waiver.

## 18. Changes to this Agreement

We may update this Agreement from time to time. Material changes may be notified through the website, dashboard, email, or other reasonable means. The updated Agreement generally applies to new orders, new usage, and continued use of the Services after the update. If you do not agree to the update, you should stop using the Services and handle unused balance or account closure under the applicable policies.

## 19. Contact

For questions about this Agreement, orders, billing, refunds, compliance, notices, or service issues, contact support@flatkey.ai or write to VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States.


All of the above contents shall be subject to the English version.`

export const DEFAULT_PRIVACY_POLICY = `# flatkey.ai Privacy Policy

Last Updated: June 4, 2026

This Privacy Policy explains how VOC AI INC ("VOC AI," "we," "us," or "our") collects, uses, shares, retains, and protects information when you access or use flatkey.ai, related flatkey.ai services, websites, dashboards, APIs, checkout pages, documentation, and support channels.

Operating entity: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States. Contact: support@flatkey.ai.

## 1. Scope

This Policy applies to account registration, organization management, purchases, top-ups, delivery, API access, model routing, usage records, billing, refunds, support, security review, and related digital services we provide. Third-party model services, payment service providers, wallets, banks, card networks, cloud services, analytics tools, or other websites process information under their own privacy policies and terms. This Policy does not replace third-party policies.

## 2. Information We Collect

We may collect information you provide directly, including name, email address, password or authentication information, company name, role, team members, billing address, business information, tax ID, VAT/GST information, invoice information, order information, support messages, refund requests, compliance materials, dashboard settings, and communications with us.

When you use the Services, we may process information relating to service delivery and use, including order number, payment ID, delivery status, balance, credit records, API key name, request ID, timestamp, service selection, model selection, Inputs, Outputs, files, images, code, prompts, usage, deduction amount, price, latency, error logs, routing information, and security events.

We may also automatically collect technical information, including IP address, device identifiers, browser type, operating system, network-inferred location, pages visited, referring URL, session events, login records, clicks and actions, diagnostic logs, crash logs, performance data, anti-fraud signals, and similar information.

We may receive information relating to your account, orders, payments, permissions, usage, security, or support matters from payment service providers, authentication providers, anti-fraud providers, support tools, analytics tools, enterprise customers, team administrators, or third-party service providers.

## 3. Inputs, Outputs, and Model Processing

Inputs you submit and Outputs you receive may pass through our systems as necessary to provide the Services and may be sent to the relevant model service or technical service to complete the request. Different models and third-party services may have different data processing, logging, training, retention, and security rules. You should review applicable rules before using a particular model and avoid submitting information you are not authorized to submit or sensitive information that is not necessary.

Unless the dashboard, documentation, or order description expressly provides a relevant feature, we do not promise to store full Input or Output history. For troubleshooting, security, metering, refund, dispute, or compliance purposes, we may retain request metadata, error records, usage records, necessary logs, and materials you voluntarily provide in support communications.

We may use aggregated, anonymized, or de-identified information for statistical analysis, capacity planning, cost management, model and service quality analysis, product improvement, risk modeling, and business operations. Such information will not reasonably identify a particular individual.

## 4. Cookies and Similar Technologies

We use cookies, local storage, pixels, logs, and similar technologies to keep you logged in, protect sessions, remember preferences, complete checkout, detect fraud and abuse, measure visits, monitor performance, troubleshoot issues, and improve the Services. You can control some cookies through browser settings, but disabling cookies may affect login, dashboard, checkout, security, usage statistics, or support functionality.

## 5. Payment and Order Information

Payments may be processed by Paddle, Stripe, banks, card networks, wallets, local payment method providers, anti-fraud providers, tax providers, invoice providers, or other necessary service providers. We may receive or store payment ID, checkout ID, order number, payment status, authorization status, settlement status, product, amount, currency, tax amount, tax rate, tax jurisdiction, invoice number, receipt number, refund status, chargeback or dispute status, billing address, country, business name, tax ID, billing email, and information needed for support processing.

We do not intentionally store full card numbers, card verification codes, bank account credentials, or wallet credentials in our own systems. Payment method data is processed by the relevant payment service provider according to its security, privacy, and payment network compliance rules. We may retain limited payment metadata, such as payment provider name, payment method type, card last four digits provided by the provider, payment ID, receipt URL, invoice URL, refund ID, and dispute ID for billing, tax, accounting, support, refund, and dispute handling.

## 6. How We Use Information

We use information to create and authenticate accounts, process orders and payments, deliver service credits, maintain balance and usage records, provide API access, process requests, calculate usage and fees, handle invoices, receipts, refunds, and disputes, send service notices, respond to support requests, troubleshoot issues, detect and prevent fraud, abuse, security incidents, and policy violations, enforce the User Agreement and third-party rules, comply with tax, accounting, audit, legal, and compliance obligations, and protect the rights and safety of VOC AI, users, third-party service providers, payment service providers, and the public.

If you choose to receive marketing, product updates, or event notices, we may use your contact information to send those communications. You may opt out using the unsubscribe method in the email or by contacting us. Service notices, security notices, billing notices, and legal notices are not affected by marketing opt-outs.

## 7. Careful Handling of Information

We limit internal access based on business need and personnel responsibilities, and use permission management, logging, reasonable encryption, monitoring, backups, and audit processes to protect account, order, payment, usage, and support information. For refunds, chargebacks, abnormal calls, security incidents, or compliance review, we may keep more detailed records and perform additional review.

We will not ask you in support communications to provide complete payment credentials, passwords, plaintext API keys, or other unnecessary sensitive credentials. If troubleshooting requires screenshots or logs, you should redact unrelated sensitive information. If materials contain unnecessary sensitive information, we may ask you to submit a redacted version.

We use reasonable efforts to limit information sharing to what is relevant for providing the Services, processing payments, completing requests, troubleshooting issues, calculating bills, handling refunds, responding to disputes, meeting legal requirements, or protecting service security.

## 8. How We Share Information

We may share information with service providers that help us operate the Services, including hosting, databases, caching, networking, logging, monitoring, security, authentication, email, customer support, analytics, payment, tax, invoice, receipt, anti-fraud, compliance, audit, and professional advisory providers.

To complete service delivery, API requests, model calls, or technical processing, we may send necessary User Content, request information, account identifiers, usage information, and metadata to model services, API platforms, cloud providers, gateway providers, or other third-party platforms. Third parties process related information under their own terms, privacy policies, data processing rules, and use policies.

We may also disclose information when required by applicable law, subpoenas, court orders, government requests, tax authorities, payment network rules, audit requirements, or regulatory requirements, or to investigate fraud, chargebacks, payment disputes, abuse, security incidents, policy violations, infringement, sanctions risk, or to protect rights, property, safety, and service integrity.

If we are involved in a merger, acquisition, financing, restructuring, asset sale, bankruptcy, or similar transaction, information may be disclosed or transferred as part of that transaction. The recipient should continue to process information according to applicable law and the protection principles reflected in this Policy.

## 9. Retention

We retain information for as long as necessary to provide the Services, maintain account and order records, deliver service credits, calculate usage and billing, handle refunds and disputes, comply with tax and accounting obligations, prevent fraud and abuse, support security, meet audit and compliance requirements, and protect rights.

Account information is generally retained for a reasonable period after account closure. Order, tax, invoice, accounting, and dispute records may be retained longer as required by law or payment network rules. Security logs, diagnostic logs, and technical records are retained as needed for operations, security, and troubleshooting.

API request, error, and usage records may have different retention periods depending on feature, log type, security need, and compliance requirement. We retain such records within the scope necessary to provide the Services, troubleshoot issues, calculate bills, handle refunds, respond to disputes, prevent abuse, and meet legal requirements.

When information is no longer needed, we delete, anonymize, or restrict further processing according to applicable law and business processes.

## 10. International Transfers

VOC AI is located in the United States. We, our service providers, payment service providers, and third-party service providers may process information in the United States, Europe, Asia, or other countries and regions. Data protection laws in those locations may differ from the laws where you are located. We will use appropriate cross-border transfer safeguards where required by applicable law.

## 11. Security

We use administrative, technical, and organizational measures such as access controls, permission management, logs, reasonable encryption, monitoring, backups, audits, and internal processes to protect information. No system can be guaranteed absolutely secure. You are also responsible for protecting your account, password, email, devices, API keys, access credentials, payment account, and related service credentials.

If you believe your account, API key, payment method, or data has been accessed or used without authorization, contact us immediately.

## 12. Your Choices and Rights

You may update some account, billing, and team information in the dashboard. Depending on your location and applicable law, you may have rights to request access, correction, deletion, portability, restriction, objection, withdrawal of consent, opt-out of certain data sharing, or to complain to a regulator.

We may need to verify your identity before processing a request. We may also retain certain information where allowed or required by applicable law, such as tax, accounting, security, risk control, payment, dispute, audit, compliance, or legal records.

We do not intentionally sell personal information for money. If applicable law treats certain advertising, analytics, or data sharing as a "sale" or "sharing," you may contact us to exercise any applicable opt-out rights.

## 13. Children's Privacy

The Services are not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided information to us, contact us so we can review and, where appropriate, delete it.

## 14. Policy Updates

We may update this Privacy Policy from time to time. Material changes may be notified through the website, dashboard, email, or other reasonable means. The updated Policy applies to information processing activities after the update.

## 15. Contact

For privacy questions, data requests, security reports, or data protection inquiries, contact support@flatkey.ai or write to VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States.


All of the above contents shall be subject to the English version.`

export const DEFAULT_REFUND_POLICY = `# flatkey.ai Refund Policy

Last Updated: June 4, 2026

This Refund Policy applies to the flatkey.ai services provided by VOC AI INC ("VOC AI," "we," "us," or "our") through flatkey.ai, checkout pages, the dashboard, and support channels, including account top-ups, prepaid account balance, service credits, API usage, digital service delivery, and related support matters.

Operating entity: VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States. Contact: support@flatkey.ai.

## 1. Basic Principles

flatkey.ai provides digital services. Account balance, service credits, and related digital services are usually delivered electronically immediately after successful payment or order approval and may be used immediately for API requests, model calls, file processing, image processing, request processing, or other paid features. Once delivery and use occur, third-party model, cloud service, payment, tax, network, and infrastructure costs may be incurred.

Our refund principles are: non-delivery, duplicate charges, verifiable system errors, and mandatory legal requirements receive priority review; delivered and used credits, consumed balance, completed requests, and successfully provided digital services are generally not refundable.

This Policy does not limit any non-waivable consumer refund, cancellation, withdrawal, digital content, digital service, or payment dispute rights provided by applicable law.

## 2. Refund Window for Unused Balance

Unused account balance or service credits may be submitted for refund review within 24 hours after purchase completion. After 24 hours, unused balance generally is not eligible for a cash refund unless applicable law requires otherwise, payment service provider rules require otherwise, or we confirm duplicate charges, non-delivery, a verifiable system error, or a tax or invoice error.

If a purchase page, order description, enterprise agreement, or applicable law provides a longer refund period, the more specific rule will apply. Promotional, reward, trial, coupon, gifted, free balance, or free credits generally are not eligible for a cash refund.

## 3. Refunds or Adjustments We May Review

You may request a refund, balance restoration, credit correction, or account adjustment in the following situations:

- the same order was charged more than once;
- payment succeeded but account balance, service credits, or digital services were not delivered;
- payment failed, was reversed, or was canceled, but the payment method still shows a charge;
- our verifiable system error caused duplicate deduction, incorrect deduction, incorrect metering, or incorrect credit delivery;
- you request within 24 hours after purchase and the related balance or credits have not been used, transferred, abused, or associated with suspicious activity;
- tax, invoice, receipt, currency, order amount, or payment method processing needs correction;
- applicable law, payment service provider rules, digital service rules, tax rules, or payment network rules require a refund;
- VOC AI, Paddle, Stripe, or another original order payment service provider determines after review that a refund or adjustment is appropriate.

Approval and handling method depend on order status, delivery records, usage records, payment status, tax and invoice requirements, risk review results, payment service provider rules, and applicable law.

## 4. Review Process

We review refund or adjustment requests using order records, payment service provider records, delivery records, balance records, usage logs, request IDs, error records, support communications, tax records, and invoice records. For usage disputes, we focus on whether requests actually occurred, whether balance was deducted, whether duplicate deduction occurred, whether there was a system error, and whether the relevant requests came from your account, API key, team members, application, or integration.

During review, we may ask you to provide account email, order number, payment ID, receipt, invoice, request ID, timestamp, screenshot, error message, or other reasonably necessary information. Requests that cannot verify order, account ownership, delivery status, usage status, or payment status may not be approved.

If we find that the related order or usage involves unauthorized resale, relay, account sharing, hiding the true user, bulk account creation, abnormal concentrated calling, fraud, abuse, sanctions risk, chargeback abuse, or limit circumvention, we may pause review, deny refunds, limit balance restoration, or take account restriction measures under the User Agreement.

If the same order has entered a chargeback, payment dispute, payment reversal, or payment service provider investigation process, we will generally handle it through the relevant payment service provider or card network process and will not separately issue an independent cash refund at the same time, to avoid duplicate refunds or accounting conflicts. After the dispute process ends, if account balance or billing corrections remain necessary, we will handle them based on the final result and system records.

## 5. Items Generally Not Refundable

Except where applicable law requires otherwise, the following are generally not refundable:

- balance or service credits used for API requests, model calls, file processing, image processing, cache use, request processing, or other paid features;
- digital services that have been successfully delivered and started;
- fees caused by accounts, team members, API keys, automated scripts, integrations, leaked keys, permission settings, internal personnel, or authorized users;
- third-party model costs, cloud service costs, minimum charges, excess usage, taxes, currency conversion differences, bank fees, card network fees, network fees, payment service provider fees, or third-party platform fees;
- promotional, reward, trial, coupon, gifted, free balance, or free credits;
- orders, balance, or service credits associated with fraud, abuse, sanctions risk, unlawful use, policy violations, account sharing, unauthorized resale, relay, provision to others, chargeback abuse, or limit circumvention;
- requests based on dissatisfaction with AI Output quality, model behavior, service availability, latency, rate limits, price changes, regional restrictions, or third-party policy changes, where the service was delivered as described or the relevant credits were used;
- issues caused by inaccurate account, email, billing, tax, business, invoice, or payment information you provided, unless applicable law or payment service provider rules require correction or refund.

## 6. Digital Content and Consumer Rights

For digital content or digital services that are delivered and usable immediately, to the extent permitted by applicable law, you may lose statutory cancellation or withdrawal rights once account balance, service credits, or related services are delivered or once you begin using the relevant services.

If your location provides non-waivable consumer protection, refund, withdrawal, cancellation, or dispute rights, we will handle requests according to applicable law even if other parts of this Policy say otherwise.

## 7. How to Request a Refund

Contact support@flatkey.ai and provide as much of the following information as possible:

- account email;
- order number, payment ID, Paddle receipt number, Stripe receipt number, payment reference, or invoice number;
- purchase date, amount, currency, and payment method type;
- reason for the refund or adjustment request;
- relevant screenshots, error messages, delivery status, balance records, or dashboard records;
- for usage issues, API key name, request ID, timestamp, model, or service name.

Duplicate charges, non-delivery, incorrect deduction, invoice errors, tax issues, or payment abnormalities should be submitted as soon as discovered. We may request additional information to verify account ownership, purchase records, delivery status, usage status, payment status, tax information, and refund eligibility.

## 8. Refund Method and Processing Time

Approved cash refunds usually return to the original payment method. Processing time depends on Paddle, Stripe, banks, card networks, wallets, local payment method providers, and other relevant service providers. We cannot guarantee when a third party will complete posting.

In some cases, we may resolve an issue through balance restoration, credit correction, account adjustment, credit note, invoice correction, or receipt update, especially where the issue concerns delivery failure, incorrect metering, duplicate deduction, or account record error.

Taxes, invoices, credit notes, receipts, currency conversion, and payment method limitations may be handled by the original order payment service provider. If an order has entered chargeback, dispute, risk control, tax review, or payment service provider restriction status, refunds may take longer or must follow the relevant process.

## 9. Paddle, Stripe, and Other Payment Service Providers

If an order is processed by Paddle as Merchant of Record or seller, Paddle may determine or execute refunds, taxes, invoices, credit notes, receipts, and payment dispute matters according to its process.

If an order is processed by Stripe or another payment processor, VOC AI may review the refund request and, where feasible, instruct the processor to return the approved refund to the original payment method. Processing rules and timing may vary by payment service provider, country, currency, payment method, and bank.

## 10. Chargebacks and Payment Disputes

If you initiate a chargeback, payment dispute, payment reversal, or similar process, we may suspend related accounts, API keys, balance, service credits, orders, or service access during the investigation.

We may provide Paddle, Stripe, banks, card networks, wallets, payment networks, tax service providers, or dispute handling bodies with order records, delivery records, usage logs, balance records, tax records, invoices, receipts, refund records, support communications, account activity, and security records to investigate and respond to disputes.

Please contact us first for duplicate charges, non-delivery, incorrect deductions, tax issues, invoices, receipts, and billing issues. Directly initiating a chargeback may result in account suspension, refund delays, dispute fees, or future purchase restrictions.

If you have already contacted a bank, card network, wallet provider, or payment service provider to initiate a dispute, tell us the dispute status and reference number in refund communications. Hiding an active dispute, requesting duplicate refunds at the same time, or continuing a chargeback after receiving a refund may be treated as chargeback abuse.

## 11. Policy Updates

We may update this Refund Policy from time to time. The updated Policy generally applies to purchases, deliveries, usage, and refund requests occurring after the update, unless applicable law or payment service provider rules require otherwise.

## 12. Contact

For questions about purchases, delivery, account balance, service credits, duplicate charges, incorrect deductions, taxes, invoices, receipts, refund eligibility, Paddle receipts, Stripe receipts, or payment disputes, contact support@flatkey.ai or write to VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States.

All of the above contents shall be subject to the English version.`

export const DEFAULT_SERVICE_LEVEL_AGREEMENT = `# flatkey.ai Service Level Agreement

Last Updated: June 13, 2026

This Service Level Agreement ("SLA") describes the service availability target and support process for flatkey.ai services provided by VOC AI INC ("VOC AI," "we," "us," or "our").

## 1. Scope

This SLA applies to the flatkey.ai hosted dashboard, API gateway, routing, metering, and account services that we directly operate. It does not apply to third-party AI model providers, payment providers, customer networks, customer applications, beta features, force majeure events, scheduled maintenance, abuse mitigation, account suspension, or issues caused by customer configuration, credentials, integrations, or policy violations.

## 2. Availability Target

We target 99.5% monthly availability for the covered flatkey.ai service endpoints. Availability is measured by our production monitoring systems for the covered services.

## 3. Maintenance and Service Changes

We may perform scheduled or emergency maintenance to improve security, reliability, performance, or compliance. We use reasonable efforts to reduce customer impact and, when practical, provide notice through the dashboard, website, email, or support channels.

## 4. Third-Party Dependencies

flatkey.ai routes requests to third-party model providers and relies on cloud, network, payment, security, and analytics providers. Third-party outages, rate limits, policy changes, regional restrictions, model behavior, or provider-side failures are outside this SLA.

## 5. Support

For service availability issues, contact support@flatkey.ai with your account email, affected endpoint, request IDs if available, timestamps, error messages, and impact summary. We review support requests based on severity, available records, and operational risk.

## 6. Remedies

Unless a separate written agreement provides a different remedy, this SLA does not create automatic service credits, refunds, penalties, or liquidated damages. Any goodwill adjustment, balance correction, or support remediation is handled case by case under the User Agreement and applicable policies.

## 7. Updates

We may update this SLA from time to time. The updated SLA generally applies to service periods after the update.

## 8. Contact

For questions about this SLA or a service incident, contact support@flatkey.ai or write to VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States.

All of the above contents shall be subject to the English version.`

export type LegalDocumentKind = 'terms' | 'privacy' | 'refund' | 'sla'

type SupportedLegalLocale = 'en' | 'zh' | 'es' | 'fr' | 'ja' | 'pt' | 'ru' | 'vi'

type LegalDocumentSet = Record<LegalDocumentKind, string>

const DEFAULT_LEGAL_LOCALE: SupportedLegalLocale = 'en'

export const DEFAULT_LEGAL_DOCUMENTS_BY_LOCALE: Record<
  SupportedLegalLocale,
  LegalDocumentSet
> = {
  en: {
    terms: DEFAULT_TERMS_OF_SERVICE,
    privacy: DEFAULT_PRIVACY_POLICY,
    refund: DEFAULT_REFUND_POLICY,
    sla: DEFAULT_SERVICE_LEVEL_AGREEMENT,
  },
  zh: {
    terms: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.zh.terms,
    privacy: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.zh.privacy,
    refund: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.zh.refund,
    sla: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.zh.sla,
  },
  es: {
    terms: ES_DEFAULT_LEGAL_DOCUMENTS.terms,
    privacy: ES_DEFAULT_LEGAL_DOCUMENTS.privacy,
    refund: ES_DEFAULT_LEGAL_DOCUMENTS.refund,
    sla: ES_DEFAULT_LEGAL_DOCUMENTS.sla,
  },
  fr: {
    terms: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.fr.terms,
    privacy: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.fr.privacy,
    refund: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.fr.refund,
    sla: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.fr.sla,
  },
  ja: {
    terms: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ja.terms,
    privacy: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ja.privacy,
    refund: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ja.refund,
    sla: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ja.sla,
  },
  pt: {
    terms: PT_DEFAULT_LEGAL_DOCUMENTS.terms,
    privacy: PT_DEFAULT_LEGAL_DOCUMENTS.privacy,
    refund: PT_DEFAULT_LEGAL_DOCUMENTS.refund,
    sla: PT_DEFAULT_LEGAL_DOCUMENTS.sla,
  },
  ru: {
    terms: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ru.terms,
    privacy: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ru.privacy,
    refund: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ru.refund,
    sla: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.ru.sla,
  },
  vi: {
    terms: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.vi.terms,
    privacy: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.vi.privacy,
    refund: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.vi.refund,
    sla: LOCALIZED_DEFAULT_LEGAL_DOCUMENTS.vi.sla,
  },
}

function resolveLegalLocale(language?: string): SupportedLegalLocale {
  const normalized = language?.toLowerCase().split('-')[0]
  if (
    normalized === 'zh' ||
    normalized === 'es' ||
    normalized === 'fr' ||
    normalized === 'ja' ||
    normalized === 'pt' ||
    normalized === 'ru' ||
    normalized === 'vi'
  ) {
    return normalized
  }
  return DEFAULT_LEGAL_LOCALE
}

export function getDefaultLegalDocument(
  kind: LegalDocumentKind,
  language?: string
): string {
  const locale = resolveLegalLocale(language)
  return DEFAULT_LEGAL_DOCUMENTS_BY_LOCALE[locale][kind]
}
