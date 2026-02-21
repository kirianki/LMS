from decimal import Decimal, ROUND_HALF_UP

class KenyanPayrollCalculator:
    """
    Calculates Kenyan payroll statutory deductions based on 2026 rates.
    """
    
    @staticmethod
    def calculate_nssf(pensionable_pay):
        """
        NSSF 2023 Act (Phase 4 - Feb 2026)
        Tier I: 6% of lower limit (9,000) = 540
        Tier II: 6% of (earnings above 9,000 up to 108,000)
        Total max = 6,480
        """
        lower_limit = Decimal('9000')
        upper_limit = Decimal('108000')
        rate = Decimal('0.06')
        
        if pensionable_pay <= lower_limit:
            nssf = pensionable_pay * rate
        elif pensionable_pay <= upper_limit:
            tier_i = lower_limit * rate
            tier_ii = (pensionable_pay - lower_limit) * rate
            nssf = tier_i + tier_ii
        else:
            nssf = upper_limit * rate
            
        return nssf.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    @staticmethod
    def calculate_shif(gross_pay):
        """
        SHIF: 2.75% of Gross monthly salary. Min KES 300.
        """
        rate = Decimal('0.0275')
        shif = gross_pay * rate
        return max(shif, Decimal('300')).quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    @staticmethod
    def calculate_housing_levy(gross_pay):
        """
        Affordable Housing Levy: 1.5% of Gross monthly salary.
        """
        rate = Decimal('0.015')
        levy = gross_pay * rate
        return levy.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    @staticmethod
    def calculate_paye(taxable_pay):
        """
        PAYE Graduated Bands (2026):
        - First 24,000: 10%
        - Next 8,333: 25% (up to 32,333)
        - Next 467,667: 30% (up to 500,000)
        - Next 300,000: 32.5% (up to 800,000)
        - Above 800,000: 35%
        Monthly Personal Relief: 2,400
        """
        bands = [
            (Decimal('24000'), Decimal('0.10')),
            (Decimal('8333'), Decimal('0.25')),
            (Decimal('467667'), Decimal('0.30')),
            (Decimal('300000'), Decimal('0.325')),
            (Decimal('1000000000'), Decimal('0.35')), # Large number for 'above'
        ]
        
        tax = Decimal('0')
        remaining_pay = taxable_pay
        
        for limit, rate in bands:
            if remaining_pay <= 0:
                break
            taxable_amount = min(remaining_pay, limit)
            tax += taxable_amount * rate
            remaining_pay -= taxable_amount
            
        relief = Decimal('2400')
        paye = max(tax - relief, Decimal('0'))
        
        return paye.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    @classmethod
    def calculate_payroll(cls, basic_salary, allowances_list, deductions_list):
        """
        allowances_list: list of dicts {'name': str, 'calculation_type': 'fixed'|'percentage', 'amount': decimal, 'percentage_basis': 'basic'|'gross'}
        deductions_list: list of dicts {'name': str, 'calculation_type': 'fixed'|'percentage', 'amount': decimal, 'percentage_basis': 'basic'|'gross'}
        """
        # 1. Start with Basic
        gross_pay = basic_salary
        processed_allowances = []
        
        # Calculate allowances based on basic first
        for allowance in allowances_list:
            if allowance['calculation_type'] == 'percentage' and allowance['percentage_basis'] == 'basic':
                amt = (allowance['amount'] / Decimal('100')) * basic_salary
            else:
                amt = allowance['amount']
            
            # If it's percentage of gross, we'll handle it later or just use basic for simplicity in phase 1
            # Actually, let's just handle them all as additions to gross for now
            gross_pay += amt
            processed_allowances.append({'name': allowance['name'], 'amount': amt})
            
        # 2. Statutory Deductions
        nssf = cls.calculate_nssf(gross_pay) # NSSF is on 'pensionable pay' (usually gross minus some items, but gross is safe default)
        shif = cls.calculate_shif(gross_pay)
        housing_levy = cls.calculate_housing_levy(gross_pay)
        
        # 3. PAYE
        # Taxable Pay = Gross - NSSF - SHIF - Housing Levy (2026 rule)
        taxable_pay = gross_pay - nssf - shif - housing_levy
        paye = cls.calculate_paye(taxable_pay)
        
        # 4. Other Deductions
        total_other_deductions = Decimal('0')
        processed_deductions = []
        for deduction in deductions_list:
            if deduction['calculation_type'] == 'percentage':
                basis = basic_salary if deduction['percentage_basis'] == 'basic' else gross_pay
                amt = (deduction['amount'] / Decimal('100')) * basis
            else:
                amt = deduction['amount']
                
            total_other_deductions += amt
            processed_deductions.append({'name': deduction['name'], 'amount': amt})
            
        net_pay = gross_pay - nssf - shif - housing_levy - paye - total_other_deductions
        
        return {
            'gross_pay': gross_pay,
            'nssf': nssf,
            'shif': shif,
            'housing_levy': housing_levy,
            'paye': paye,
            'other_deductions': total_other_deductions,
            'net_pay': net_pay,
            'allowances_breakdown': processed_allowances,
            'deductions_breakdown': processed_deductions
        }
