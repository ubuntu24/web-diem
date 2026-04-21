"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Student, Grade } from '@/lib/types';
import { clsx } from 'clsx';
import { TrendingUp, BarChart2, Info } from 'lucide-react';

interface StudentChartsProps {
    student: Student;
    scale: '4' | '10';
}

export default function StudentCharts({ student, scale }: StudentChartsProps) {
    const gpaLineRef = useRef<SVGSVGElement>(null);
    const distBarRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartType, setChartType] = useState<'trend' | 'dist'>('trend');
    const [dimensions, setDimensions] = useState({ width: 0, height: 250 });

    // GPA Trend Data with Grade Distribution
    const getGpaData = () => {
        if (!student.semester_gpa || !student.diem) return [];
        
        // Group grades by semester for counts
        const semDetails: Record<string, Record<string, number>> = {};
        student.diem.forEach(g => {
            if (g.exclude_from_gpa) return;
            // Use the same normalization or key logic as Dashboard
            const sem = (g.hoc_ky || '').trim() || 'Khác';
            if (!semDetails[sem]) {
                semDetails[sem] = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
            }
            const char = (g.diem_chu || '').charAt(0).toUpperCase();
            if (semDetails[sem].hasOwnProperty(char)) {
                semDetails[sem][char]++;
            }
        });

        return Object.entries(student.semester_gpa)
            .map(([sem, values]) => ({
                semester: sem,
                gpa: scale === '4' ? values.gpa4 : values.gpa10,
                counts: semDetails[sem] || { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 }
            }))
            .sort((a, b) => {
                // Advanced sorting: Extract years (4 digits) and semesters (1-2 digits)
                const getScore = (s: string) => {
                    const years = s.match(/\d{4}/g)?.map(Number) || [];
                    const digits = s.match(/\d+/g)?.map(Number) || [];
                    const primaryYear = years[0] || 0;
                    // Find semester digit (usually 1, 2, 3) which is NOT the year
                    const semester = digits.find(n => n < 100) || 0;
                    return primaryYear * 100 + semester;
                };
                
                const scoreA = getScore(a.semester);
                const scoreB = getScore(b.semester);
                
                if (scoreA !== scoreB) return scoreA - scoreB;
                return a.semester.localeCompare(b.semester, undefined, { numeric: true });
            });
    };

    // Grade Distribution Data
    const getDistData = () => {
        if (!student.diem) return [];
        const counts: Record<string, number> = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
        student.diem.forEach(g => {
            if (g.exclude_from_gpa) return;
            const char = (g.diem_chu || '').charAt(0).toUpperCase();
            if (counts.hasOwnProperty(char)) {
                counts[char]++;
            }
        });
        return Object.entries(counts).map(([label, value]) => ({ label, value }));
    };

    useEffect(() => {
        if (!containerRef.current) return;
        
        // Initial measurement
        setDimensions({
            width: containerRef.current.clientWidth,
            height: 250
        });

        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries[0]) return;
            const { width } = entries[0].contentRect;
            if (width > 0) {
                setDimensions(prev => ({ ...prev, width }));
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (dimensions.width === 0) return;
        if (chartType === 'trend') {
            renderGpaTrend();
        } else {
            renderGradeDist();
        }
    }, [student, scale, chartType, dimensions]);

    const getTooltip = (container: d3.Selection<any, any, any, any>) => {
        let tooltip = container.select(".chart-tooltip") as any;
        if (tooltip.empty()) {
            tooltip = container.append("div")
                .attr("class", "chart-tooltip absolute hidden z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-2xl text-xs pointer-events-none transition-opacity duration-200 border-l-4 border-l-blue-500");
        }
        return tooltip;
    };

    const renderGpaTrend = () => {
        if (!gpaLineRef.current || !containerRef.current) return;
        const data = getGpaData();
        if (data.length === 0) return;

        const svg = d3.select(gpaLineRef.current);
        const container = d3.select(containerRef.current);
        svg.selectAll("*").remove();
        
        const tooltip = getTooltip(container);

        const width = dimensions.width;
        const height = dimensions.height;
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };

        const x = d3.scalePoint()
            .domain(data.map(d => d.semester))
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, scale === '4' ? 4 : 10])
            .range([height - margin.bottom, margin.top]);

        // Draw Line
        const line = d3.line<any>()
            .x(d => x(d.semester)!)
            .y(d => y(d.gpa))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 3)
            .attr("d", line);

        // Add area
        const area = d3.area<any>()
            .x(d => x(d.semester)!)
            .y0(height - margin.bottom)
            .y1(d => y(d.gpa))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(data)
            .attr("fill", "url(#line-gradient)")
            .attr("opacity", 0.2)
            .attr("d", area);

        // Gradient
        const gradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "line-gradient")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6");
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "transparent");

        // Interactive Dots
        svg.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.semester)!)
            .attr("cy", d => y(d.gpa))
            .attr("r", 5)
            .attr("fill", "#3b82f6")
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .style("cursor", "pointer")
            .style("transition", "all 0.2s ease")
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget).attr("r", 8).attr("fill", "#2563eb");
                tooltip.style("display", "block").style("opacity", "0");
                
                const gradeInfo = Object.entries(d.counts)
                    .filter(([_, count]) => count > 0)
                    .map(([label, count]) => `
                        <div class="flex items-center justify-between gap-4 py-0.5">
                            <span class="flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full ${
                                    label === 'A' ? 'bg-emerald-500' : 
                                    label === 'B' ? 'bg-blue-500' : 
                                    label === 'C' ? 'bg-amber-500' : 
                                    label === 'D' ? 'bg-rose-500' : 'bg-slate-400'
                                }"></span>
                                <b class="text-slate-700 dark:text-slate-300">Metric ${label}</b>
                            </span>
                            <span class="font-medium text-slate-900 dark:text-white">${count} môn</span>
                        </div>
                    `)
                    .join("");

                tooltip.html(`
                    <div class="font-bold text-slate-900 dark:text-white mb-2 pb-1 border-b border-slate-100 dark:border-slate-700">${d.semester}</div>
                    <div class="flex items-center gap-2 mb-3">
                        <span class="flex-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold text-center">
                            GPA: ${d.gpa.toFixed(2)}
                        </span>
                    </div>
                    <div class="space-y-0.5">
                        ${gradeInfo || '<div class="text-slate-400">Không có dữ liệu chi tiết</div>'}
                    </div>
                `);

                tooltip.transition().duration(200).style("opacity", "1");
            })
            .on("mousemove", (event) => {
                const [mx, my] = d3.pointer(event);
                const tooltipNode = tooltip.node() as HTMLElement;
                const tx = mx + 20 + tooltipNode.offsetWidth > width ? mx - 20 - tooltipNode.offsetWidth : mx + 20;
                tooltip.style("left", tx + "px").style("top", (my - 20) + "px");
            })
            .on("mouseleave", (event) => {
                d3.select(event.currentTarget).attr("r", 5).attr("fill", "#3b82f6");
                tooltip.transition().duration(200).style("opacity", "0").on("end", () => tooltip.style("display", "none"));
            });

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
            .attr("color", "#64748b")
            .selectAll("text")
            .style("font-size", "10px");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right))
            .attr("color", "#e2e8f0")
            .selectAll("text")
            .attr("color", "#64748b")
            .style("font-size", "10px");
            
        svg.select(".domain").remove();
    };

    const renderGradeDist = () => {
        if (!distBarRef.current || !containerRef.current) return;
        const data = getDistData();
        
        const svg = d3.select(distBarRef.current);
        const container = d3.select(containerRef.current);
        svg.selectAll("*").remove();

        const tooltip = getTooltip(container);

        const width = dimensions.width;
        const height = dimensions.height;
        const margin = { top: 20, right: 30, bottom: 40, left: 40 };

        const x = d3.scaleBand()
            .domain(data.map(d => d.label))
            .range([margin.left, width - margin.right])
            .padding(0.3);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.value) || 10])
            .range([height - margin.bottom, margin.top]);

        // Bars
        svg.selectAll("rect")
            .data(data)
            .enter()
            .append("rect")
            .attr("x", d => x(d.label)!)
            .attr("y", d => y(d.value))
            .attr("height", d => height - margin.bottom - y(d.value))
            .attr("width", x.bandwidth())
            .attr("fill", d => {
                if (d.label === 'A') return '#10b981';
                if (d.label === 'B') return '#3b82f6';
                if (d.label === 'C') return '#f59e0b';
                if (d.label === 'D') return '#ef4444';
                return '#64748b';
            })
            .attr("rx", 6)
            .style("cursor", "pointer")
            .style("transition", "all 0.2s ease")
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget).attr("opacity", 0.8).attr("y", y(d.value) - 5).attr("height", height - margin.bottom - y(d.value) + 5);
                tooltip.style("display", "block").style("opacity", "0");
                tooltip.html(`
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full ${
                            d.label === 'A' ? 'bg-emerald-500' :
                            d.label === 'B' ? 'bg-blue-500' :
                            d.label === 'C' ? 'bg-amber-500' :
                            d.label === 'D' ? 'bg-rose-500' : 'bg-slate-400'
                        }"></span>
                        <span class="font-bold text-slate-900 dark:text-white">Loại ${d.label}: ${d.value} môn</span>
                    </div>
                `);
                tooltip.transition().duration(200).style("opacity", "1");
            })
            .on("mousemove", (event) => {
                const [mx, my] = d3.pointer(event);
                tooltip.style("left", (mx + 15) + "px").style("top", (my - 15) + "px");
            })
            .on("mouseleave", (event, d) => {
                d3.select(event.currentTarget).attr("opacity", 1).attr("y", y(d.value)).attr("height", height - margin.bottom - y(d.value));
                tooltip.transition().duration(200).style("opacity", "0").on("end", () => tooltip.style("display", "none"));
            });

        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).tickSize(0).tickPadding(10))
            .attr("color", "#64748b")
            .selectAll("text")
            .style("font-size", "12px");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right))
            .attr("color", "#e2e8f0")
            .selectAll("text")
            .attr("color", "#64748b")
            .style("font-size", "10px");

        svg.select(".domain").remove();
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-8 transition-all hover:shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                        {chartType === 'trend' ? <TrendingUp className="w-5 h-5" /> : <BarChart2 className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">
                            {chartType === 'trend' ? 'Xu hướng GPA' : 'Phân bổ Result'}
                        </h3>
                        <p className="text-xs text-slate-500">Trực quan hóa dữ liệu Performance</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setChartType('trend')}
                        className={clsx(
                            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                            chartType === 'trend' ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        Xu hướng
                    </button>
                    <button
                        onClick={() => setChartType('dist')}
                        className={clsx(
                            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all",
                            chartType === 'dist' ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        Phân bổ
                    </button>
                </div>
            </div>

            <div ref={containerRef} className="relative w-full overflow-hidden">
                {chartType === 'trend' ? (
                    <svg ref={gpaLineRef} className="w-full h-[250px] animate-in fade-in slide-in-from-bottom-2 duration-500" />
                ) : (
                    <svg ref={distBarRef} className="w-full h-[250px] animate-in fade-in slide-in-from-bottom-2 duration-500" />
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-400 italic">
                <Info className="w-3.5 h-3.5" />
                Dữ liệu được cập nhật từ hệ thống phân tích record chính thức.
            </div>
        </div>
    );
}
