from decimal import Decimal

def auto_release_loan_collateral(loan):
    """
    Check and release collaterals linked to a loan if they are no longer in use.
    A collateral is released if no other ACTIVE/OVERDUE loans are using it.
    """
    from apps.collateral.models import Collateral
    collaterals_to_release = []
    if loan.collateral:
        collaterals_to_release.append(loan.collateral)
    
    # Add all M2M collaterals
    if hasattr(loan, 'collaterals'):
        collaterals_to_release.extend(list(loan.collaterals.all()))

    released_count = 0
    for collateral in set(collaterals_to_release):
        # Check if any OTHER active/overdue loans are still using this collateral
        other_active = collateral.loans.filter(status__in=['active', 'overdue']).exclude(id=loan.id).exists() or \
                       collateral.loans_m2m.filter(status__in=['active', 'overdue']).exclude(id=loan.id).exists()
        
        if not other_active:
            collateral.status = Collateral.CollateralStatus.AVAILABLE
            collateral.save()
            released_count += 1
    
    return released_count
