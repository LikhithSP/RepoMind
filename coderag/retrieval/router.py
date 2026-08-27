"""
Query Router (Agentic classification).
CR-18: Classifies query as code / doc / issue / mixed to apply payload filter.
"""
import re
from typing import Dict, Any, Literal


class QueryRouter:
    def __init__(self):
        # Code patterns: function calls, symbols, code constructs
        self.code_patterns = [
            r'def\s+\w+', r'class\s+\w+', r'function', r'method', r'variable',
            r'import', r'\.py', r'parameter', r'args', r'kwargs', r'return',
            r'exception', r'middleware', r'implementation', r'code'
        ]
        # Doc patterns: guides, architecture, how-to, install, license, general overview
        self.doc_patterns = [
            r'readme', r'install', r'prerequisite', r'requirement', r'setup',
            r'documentation', r'guide', r'tutorial', r'license', r'architecture',
            r'overview', r'contribute', r'contributing', r'changelog',
            r'what.*(project|library|package|repo|tool)',
            r'explain', r'describe', r'purpose', r'about', r'summary',
            r'how.*(work|use|start)', r'getting started', r'what is', r'what does'
        ]
        # Issue patterns: bugs, discussions, crashes, open/closed issues
        self.issue_patterns = [
            r'issue', r'bug', r'ticket', r'error', r'crash', r'fail',
            r'problem', r'discussion', r'#\d+', r'feature request', r'regression'
        ]


    def classify(self, query: str) -> Dict[str, Any]:
        q_lower = query.lower()

        code_score = sum(1 for p in self.code_patterns if re.search(p, q_lower))
        doc_score = sum(1 for p in self.doc_patterns if re.search(p, q_lower))
        issue_score = sum(1 for p in self.issue_patterns if re.search(p, q_lower))

        # Check for symbol names like camelCase or snake_case
        if re.search(r'\b[a-z]+_[a-z0-9_]+\b', query) or re.search(r'\b[a-z]+[A-Z][a-zA-Z0-9]+\b', query):
            code_score += 2

        scores = {
            "code": code_score,
            "doc": doc_score,
            "issue": issue_score
        }

        max_type = max(scores, key=scores.get)
        max_val = scores[max_type]

        # If low signal or multiple competing categories, default to 'mixed'
        if max_val == 0 or (code_score > 0 and (doc_score > 0 or issue_score > 0) and abs(code_score - max(doc_score, issue_score)) == 0):
            intent = "mixed"
            reason = "Query contains multi-domain keywords or broad exploration; searching all scopes."
        else:
            intent = max_type
            reason = f"Identified dominant intent as '{intent}' with score {max_val}."

        return {
            "intent": intent,
            "scores": scores,
            "reason": reason
        }


_router_instance = None


def get_query_router() -> QueryRouter:
    global _router_instance
    if _router_instance is None:
        _router_instance = QueryRouter()
    return _router_instance
