# Stripe — Premium Foyer

Abonnement **6,90 €/mois** via Stripe Checkout.

## 1. Créer le produit Stripe

1. [dashboard.stripe.com](https://dashboard.stripe.com) → Produits → Ajouter
2. Nom : `Premium Foyer`
3. Prix récurrent mensuel : **6,90 EUR**
4. Copier le **Price ID** (`price_…`)

## 2. Clés API

Developers → API keys :
- **Secret key** → `MAJORDOME_STRIPE_SECRET_KEY` (`sk_test_…` ou `sk_live_…`)

## 3. Webhook

Developers → Webhooks → Add endpoint :

| Champ | Valeur |
|-------|--------|
| URL | `https://api.majordom.eu/api/v1/webhooks/stripe` |
| Events | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` |

Copier le **Signing secret** (`whsec_…`) → `MAJORDOME_STRIPE_WEBHOOK_SECRET`.

## 4. Variables d’environnement

```bash
MAJORDOME_STRIPE_SECRET_KEY=sk_...
MAJORDOME_STRIPE_WEBHOOK_SECRET=whsec_...
MAJORDOME_STRIPE_PRICE_ID=price_...
MAJORDOME_STRIPE_SUCCESS_URL=https://majordom.eu/?billing=success
MAJORDOME_STRIPE_CANCEL_URL=https://majordom.eu/?billing=cancel
# Optionnel — activation manuelle fondateurs
MAJORDOME_PREMIUM_FOUNDER_CODE=mon-code-secret
```

Puis redéployer.

## 5. Parcours utilisateur

1. Bandeau captures / Paramètres → **Passer en Premium**
2. Stripe Checkout
3. Retour `?billing=success` → foyer `subscription_tier=premium`
4. **Gérer l’abonnement** → Customer Portal Stripe

## Code fondateur (sans Stripe)

```http
POST /api/v1/billing/activate-founder
{ "code": "mon-code-secret" }
```
